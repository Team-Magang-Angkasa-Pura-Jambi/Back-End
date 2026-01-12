



import logging
import warnings
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any, Tuple

import holidays
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sklearn.exceptions import InconsistentVersionWarning




warnings.filterwarnings("ignore", category=InconsistentVersionWarning)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("Sentinel-ML")


MODEL_FILES = {
    "prediksi_pax": "model_prediksi_pax.pkl",
    "prediksi_terminal": "model_prediksi_terminal.pkl",
    "prediksi_kantor": "model_prediksi_kantor.pkl",
    "klasifikasi_terminal": "model_klasifikasi_terminal.pkl",
    "klasifikasi_kantor": "model_klasifikasi_kantor.pkl"
}


models: Dict[str, Any] = {}


holidays_id = holidays.Indonesia()




@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Mengelola siklus hidup aplikasi.
    Memuat model saat aplikasi mulai dan membersihkannya saat berhenti.
    """
    logger.info("🔄 Memulai proses pemuatan model ML...")
    try:
        loaded_count = 0
        for key, filename in MODEL_FILES.items():
            models[key] = joblib.load(filename)
            loaded_count += 1
            logger.debug(f"✅ Model dimuat: {key}")
        
        logger.info(f"🚀 Sistem siap! {loaded_count} model berhasil dimuat.")
        yield 
        
    except FileNotFoundError as e:
        logger.critical(f"❌ Gagal memuat file model: {e}. Cek path file .pkl Anda.")
        raise e
    except Exception as e:
        logger.critical(f"❌ Error fatal saat startup: {e}")
        raise e
    finally:
        
        models.clear()
        logger.info("🛑 Aplikasi dimatikan, resource dibersihkan.")




app = FastAPI(
    title="Sentinel Energy ML API",
    description="Microservice untuk prediksi alokasi dana dan evaluasi efisiensi energi.",
    version="3.2.0",
    lifespan=lifespan
)




class PredictionInput(BaseModel):
    tanggal: str
    suhu_rata: float
    suhu_max: float

class EvaluationInputTerminal(BaseModel):
    pax: int
    suhu_rata: float
    suhu_max: float
    aktual_kwh_terminal: float

class EvaluationInputKantor(BaseModel):
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int
    aktual_kwh_kantor: float

class EvaluationInputFull(BaseModel):
    pax: int
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int
    aktual_kwh_terminal: float
    aktual_kwh_kantor: float




@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Error di {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "Terjadi kesalahan sistem. Silakan cek log server."
        },
    )




def _get_date_features(date_str: str) -> Tuple[datetime, int]:
    """Mengubah string tanggal menjadi datetime dan mendeteksi is_workday."""
    try:
        target_date = pd.to_datetime(date_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Format tanggal salah: {e}")

    is_holiday = 1 if target_date in holidays_id else 0
    
    is_workday = 1 if target_date.dayofweek < 5 and not is_holiday else 0
    
    return target_date, is_workday

def _predict_pax_logic(target_date: datetime, is_workday: int) -> float:
    """Logika prediksi jumlah penumpang."""
    is_holiday = 1 if target_date in holidays_id else 0
    
    df_features = pd.DataFrame([{
        'dayofweek': target_date.dayofweek,
        'month': target_date.month,
        'dayofyear': target_date.dayofyear,
        'is_hari_kerja': is_workday,
        'is_holiday': is_holiday,
    }])
    
    features = ['dayofweek', 'month', 'dayofyear', 'is_hari_kerja', 'is_holiday']
    return float(models['prediksi_pax'].predict(df_features[features])[0])

def _predict_terminal_logic(pax: float, suhu_rata: float, suhu_max: float) -> float:
    """Logika prediksi kWh Terminal."""
    df_features = pd.DataFrame([{'pax': pax, 'suhu_rata': suhu_rata, 'suhu_max': suhu_max}])
    return float(models['prediksi_terminal'].predict(df_features)[0])

def _predict_kantor_logic(suhu_rata: float, suhu_max: float, is_hari_kerja: int) -> float:
    """Logika prediksi kWh Kantor."""
    df_features = pd.DataFrame([{
        'suhu_rata': suhu_rata, 
        'suhu_max': suhu_max, 
        'Hari_Hari Kerja': is_hari_kerja
    }])
    return float(models['prediksi_kantor'].predict(df_features)[0])

def _evaluate_terminal_logic(pax: int, suhu_rata: float, suhu_max: float, aktual_kwh: float) -> dict:
    """Logika evaluasi efisiensi Terminal."""
    
    pred_normal = _predict_terminal_logic(pax, suhu_rata, suhu_max)
    
    
    deviasi = 0.0
    if pred_normal > 0:
        deviasi = ((aktual_kwh - pred_normal) / pred_normal) * 100
    
    
    df_klas = pd.DataFrame([{'pax': pax, 'suhu_max': suhu_max, 'deviasi_persen': deviasi}])
    label_encoded = int(models['klasifikasi_terminal'].predict(df_klas)[0])
    
    mapping = {0: 'Boros', 1: 'Layanan Tidak Maksimal / Sangat Efisien', 2: 'Normal'}
    
    return {
        "kinerja_terminal": mapping.get(label_encoded, "Unknown"),
        "deviasi_persen_terminal": round(deviasi, 2),
        "benchmark_kwh_terminal": round(pred_normal, 2) 
    }

def _evaluate_kantor_logic(suhu_rata: float, suhu_max: float, is_workday: int, aktual_kwh: float) -> dict:
    """Logika evaluasi efisiensi Kantor."""
    
    pred_normal = _predict_kantor_logic(suhu_rata, suhu_max, is_workday)
    
    
    deviasi = 0.0
    if pred_normal > 0:
        deviasi = ((aktual_kwh - pred_normal) / pred_normal) * 100
    
    
    df_klas = pd.DataFrame([{
        'Hari_Hari Kerja': is_workday, 
        'suhu_max': suhu_max, 
        'deviasi_persen_kantor': deviasi
    }])
    label_encoded = int(models['klasifikasi_kantor'].predict(df_klas)[0])
    
    mapping = {0: 'Boros', 1: 'Efisien', 2: 'Normal'}
    
    return {
        "kinerja_kantor": mapping.get(label_encoded, "Unknown"),
        "deviasi_persen_kantor": round(deviasi, 2),
        "benchmark_kwh_kantor": round(pred_normal, 2)
    }




@app.get("/")
def read_root():
    return {"status": "active", "service": "Sentinel ML API"}

@app.post("/predict", summary="Prediksi Lengkap")
def predict_all(data: PredictionInput):
    target_date, is_workday = _get_date_features(data.tanggal)
    
    
    pred_pax = _predict_pax_logic(target_date, is_workday)
    pred_terminal = _predict_terminal_logic(pred_pax, data.suhu_rata, data.suhu_max)
    pred_kantor = _predict_kantor_logic(data.suhu_rata, data.suhu_max, is_workday)
    
    return {
        "prediksi_pax": round(pred_pax),
        "prediksi_kwh_terminal": round(pred_terminal, 2),
        "prediksi_kwh_kantor": round(pred_kantor, 2)
    }

@app.post("/predict/terminal", summary="Prediksi Terminal Saja")
def predict_terminal(data: PredictionInput):
    target_date, is_workday = _get_date_features(data.tanggal)
    pred_pax = _predict_pax_logic(target_date, is_workday)
    pred_terminal = _predict_terminal_logic(pred_pax, data.suhu_rata, data.suhu_max)
    
    return {"prediksi_kwh_terminal": round(pred_terminal, 2)}

@app.post("/predict/kantor", summary="Prediksi Kantor Saja")
def predict_kantor(data: PredictionInput):
    target_date, is_workday = _get_date_features(data.tanggal)
    pred_kantor = _predict_kantor_logic(data.suhu_rata, data.suhu_max, is_workday)
    
    return {"prediksi_kwh_kantor": round(pred_kantor, 2)}

@app.post("/evaluate", summary="Evaluasi Lengkap")
def evaluate_all(data: EvaluationInputFull):
    term_res = _evaluate_terminal_logic(data.pax, data.suhu_rata, data.suhu_max, data.aktual_kwh_terminal)
    kantor_res = _evaluate_kantor_logic(data.suhu_rata, data.suhu_max, data.is_hari_kerja, data.aktual_kwh_kantor)
    
    return {**term_res, **kantor_res}

@app.post("/evaluate/terminal", summary="Evaluasi Terminal Saja")
def evaluate_terminal(data: EvaluationInputTerminal):
    return _evaluate_terminal_logic(data.pax, data.suhu_rata, data.suhu_max, data.aktual_kwh_terminal)

@app.post("/evaluate/kantor", summary="Evaluasi Kantor Saja")
def evaluate_kantor(data: EvaluationInputKantor):
    return _evaluate_kantor_logic(data.suhu_rata, data.suhu_max, data.is_hari_kerja, data.aktual_kwh_kantor)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)