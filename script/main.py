# main.py
# Server backend FastAPI untuk melayani model machine learning alokasi dana.
# Versi ini mengintegrasikan model prediksi pax secara internal.

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import joblib
import logging
from datetime import datetime
import warnings
from sklearn.exceptions import InconsistentVersionWarning
import holidays

# Mengabaikan warning versi scikit-learn saat memuat model.
warnings.filterwarnings("ignore", category=InconsistentVersionWarning)

# --- 1. Pydantic Models (Untuk Validasi Input Otomatis) ---
class PredictionInput(BaseModel):
    """Struktur data untuk endpoint /predict."""
    tanggal: str 
    suhu_rata: float
    suhu_max: float

class EvaluationInput(BaseModel):
    """Struktur data untuk endpoint /evaluate."""
    pax: int
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int # Diharapkan 1 untuk hari kerja, 0 untuk lainnya
    aktual_kwh_terminal: float
    aktual_kwh_kantor: float

# BARU: Model input untuk evaluasi spesifik
class EvaluationInputTerminal(BaseModel):
    """Struktur data untuk endpoint /evaluate/terminal."""
    pax: int
    suhu_rata: float
    suhu_max: float
    aktual_kwh_terminal: float

class EvaluationInputKantor(BaseModel):
    """Struktur data untuk endpoint /evaluate/kantor."""
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int
    aktual_kwh_kantor: float

# --- 2. Inisialisasi Aplikasi dan Konfigurasi ---

app = FastAPI(
    title="API Alokasi Dana Energi",
    description="API untuk prediksi dan evaluasi konsumsi energi dengan prediksi pax terintegrasi.",
    version="3.1.0"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models = {}

# Inisialisasi kalender hari libur Indonesia
holidays_id = holidays.Indonesia()

# --- Penanganan Error Terpusat ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Menangani semua error tak terduga dan mengembalikan respons JSON yang bersih."""
    logger.error(f"Terjadi error tak terduga pada request: {request.method} {request.url}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "Terjadi kesalahan pada server. Silakan hubungi administrator."
        },
    )

@app.on_event("startup")
def load_models():
    """Memuat semua model .pkl saat aplikasi pertama kali dijalankan."""
    model_files = [
        'model_prediksi_pax.pkl', # Model untuk memprediksi penumpang
        'model_prediksi_terminal.pkl',
        'model_prediksi_kantor.pkl',
        'model_klasifikasi_terminal.pkl',
        'model_klasifikasi_kantor.pkl'
    ]
    try:
        for file in model_files:
            model_name = file.replace('.pkl', '')
            models[model_name] = joblib.load(file)
        logger.info("✅ Semua 5 model berhasil dimuat saat startup.")
    except FileNotFoundError as e:
        logger.error(f"❌ KRITIKAL: Gagal memuat file model: {e}. Aplikasi akan berhenti.")
        exit(1)

# --- 3. Helper Functions (Untuk Logika Prediksi yang Digunakan Ulang) ---

def _predict_pax(target_date: datetime) -> tuple[float, int]:
    """Helper untuk memprediksi jumlah penumpang (pax) dan status hari kerja."""
    is_holiday_val = 1 if target_date in holidays_id else 0
    is_workday_val = 1 if target_date.dayofweek < 5 and not is_holiday_val else 0

    df_pred_pax = pd.DataFrame([{
        'dayofweek': target_date.dayofweek,
        'month': target_date.month,
        'dayofyear': target_date.dayofyear,
        'is_hari_kerja': is_workday_val,
        'is_holiday': is_holiday_val,
    }])
    
    time_features = ['dayofweek', 'month', 'dayofyear', 'is_hari_kerja', 'is_holiday']
    predicted_pax = float(models['model_prediksi_pax'].predict(df_pred_pax[time_features])[0])
    
    return predicted_pax, is_workday_val

def _predict_terminal_kwh(pax: float, suhu_rata: float, suhu_max: float) -> float:
    """Helper untuk memprediksi konsumsi kWh Terminal."""
    df_prakiraan = pd.DataFrame([{
        'pax': pax,
        'suhu_rata': suhu_rata,
        'suhu_max': suhu_max
    }])
    features_terminal = ['pax', 'suhu_rata', 'suhu_max']
    pred_terminal = float(models['model_prediksi_terminal'].predict(df_prakiraan[features_terminal])[0])
    return pred_terminal

def _predict_kantor_kwh(suhu_rata: float, suhu_max: float, is_hari_kerja: int) -> float:
    """Helper untuk memprediksi konsumsi kWh Kantor."""
    df_prakiraan = pd.DataFrame([{
        'suhu_rata': suhu_rata,
        'suhu_max': suhu_max,
        'Hari_Hari Kerja': is_hari_kerja
    }])
    features_kantor = ['suhu_rata', 'suhu_max', 'Hari_Hari Kerja']
    pred_kantor = float(models['model_prediksi_kantor'].predict(df_prakiraan[features_kantor])[0])
    return pred_kantor

# BARU: Helper Functions untuk Logika Evaluasi
def _evaluate_terminal(pax: int, suhu_rata: float, suhu_max: float, aktual_kwh_terminal: float) -> dict:
    """Helper untuk mengevaluasi kinerja Terminal."""
    df_evaluasi = pd.DataFrame([{'pax': pax, 'suhu_rata': suhu_rata, 'suhu_max': suhu_max}])
    
    features_terminal = ['pax', 'suhu_rata', 'suhu_max']
    pred_normal_term = float(models['model_prediksi_terminal'].predict(df_evaluasi[features_terminal])[0])
    
    deviasi_term = 0.0
    if pred_normal_term > 0:
        deviasi_term = ((aktual_kwh_terminal - pred_normal_term) / pred_normal_term) * 100
    
    features_klas_term = pd.DataFrame([{'pax': pax, 'suhu_max': suhu_max, 'deviasi_persen': deviasi_term}])
    klas_term_encoded = int(models['model_klasifikasi_terminal'].predict(features_klas_term)[0])

    mapping_terminal = {0: 'Boros', 1: 'Layanan Tidak Maksimal / Sangat Efisien', 2: 'Normal'}
    
    return {
        "kinerja_terminal": mapping_terminal.get(klas_term_encoded, "Label Tidak Dikenal"),
        "deviasi_persen_terminal": round(deviasi_term, 2),
    }

def _evaluate_kantor(suhu_rata: float, suhu_max: float, is_hari_kerja: int, aktual_kwh_kantor: float) -> dict:
    """Helper untuk mengevaluasi kinerja Kantor."""
    df_evaluasi = pd.DataFrame([{'suhu_rata': suhu_rata, 'suhu_max': suhu_max, 'Hari_Hari Kerja': is_hari_kerja}])

    features_kantor = ['suhu_rata', 'suhu_max', 'Hari_Hari Kerja']
    pred_normal_kantor = float(models['model_prediksi_kantor'].predict(df_evaluasi[features_kantor])[0])

    deviasi_kantor = 0.0
    if pred_normal_kantor > 0:
        deviasi_kantor = ((aktual_kwh_kantor - pred_normal_kantor) / pred_normal_kantor) * 100

    features_klas_kantor = pd.DataFrame([{'Hari_Hari Kerja': is_hari_kerja, 'suhu_max': suhu_max, 'deviasi_persen_kantor': deviasi_kantor}])
    klas_kantor_encoded = int(models['model_klasifikasi_kantor'].predict(features_klas_kantor)[0])

    mapping_kantor = {0: 'Boros', 1: 'Efisien', 2: 'Normal'}
    
    return {
        "kinerja_kantor": mapping_kantor.get(klas_kantor_encoded, "Label Tidak Dikenal"),
        "deviasi_persen_kantor": round(deviasi_kantor, 2)
    }

# --- 3. API Endpoints (URL) ---

@app.get("/")
def read_root():
    """Endpoint dasar untuk mengecek apakah API berjalan."""
    return {"status": "API Machine Learning Aktif"}

@app.post("/predict", summary="Prediksi Keseluruhan (Pax, Terminal, Kantor)")
def predict_consumption(data: PredictionInput):
    """
    Membuat prediksi lengkap (Pax dan kWh) berdasarkan tanggal dan prakiraan suhu.
    """
    try:
        target_date = pd.to_datetime(data.tanggal)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Format tanggal tidak valid: {e}")

    # Langkah 1: Prediksi Pax dan dapatkan status hari kerja
    predicted_pax, is_workday_val = _predict_pax(target_date)

    # Langkah 2: Prediksi kWh Terminal dan Kantor menggunakan helper
    pred_terminal = _predict_terminal_kwh(predicted_pax, data.suhu_rata, data.suhu_max)
    pred_kantor = _predict_kantor_kwh(data.suhu_rata, data.suhu_max, is_workday_val)

    # Langkah 3: Kembalikan semua hasil prediksi
    return {
        "prediksi_pax": round(predicted_pax),
        "prediksi_kwh_terminal": round(pred_terminal, 2),
        "prediksi_kwh_kantor": round(pred_kantor, 2)
    }

@app.post("/predict/terminal", summary="Prediksi Khusus Terminal")
def predict_terminal_consumption(data: PredictionInput):
    """Membuat prediksi kWh khusus untuk Terminal."""
    try:
        target_date = pd.to_datetime(data.tanggal)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Format tanggal tidak valid: {e}")

    predicted_pax, _ = _predict_pax(target_date)
    pred_terminal = _predict_terminal_kwh(predicted_pax, data.suhu_rata, data.suhu_max)

    return {
        "prediksi_kwh_terminal": round(pred_terminal, 2)
    }

@app.post("/predict/kantor", summary="Prediksi Khusus Kantor")
def predict_kantor_consumption(data: PredictionInput):
    """Membuat prediksi kWh khusus untuk Kantor."""
    try:
        target_date = pd.to_datetime(data.tanggal)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Format tanggal tidak valid: {e}")

    # Model kantor tidak butuh pax, hanya status hari kerja
    _, is_workday_val = _predict_pax(target_date)
    pred_kantor = _predict_kantor_kwh(data.suhu_rata, data.suhu_max, is_workday_val)

    return {
        "prediksi_kwh_kantor": round(pred_kantor, 2)
    }

@app.post("/evaluate", summary="Evaluasi Keseluruhan (Terminal & Kantor)")
def evaluate_performance(data: EvaluationInput):
    """Mengevaluasi kinerja harian dengan metode dinamis."""
    logger.info(f"Menerima request /evaluate: {data.dict()}")

    # Panggil helper untuk evaluasi Terminal
    terminal_result = _evaluate_terminal(
        pax=data.pax,
        suhu_rata=data.suhu_rata,
        suhu_max=data.suhu_max,
        aktual_kwh_terminal=data.aktual_kwh_terminal
    )

    # Panggil helper untuk evaluasi Kantor
    kantor_result = _evaluate_kantor(
        suhu_rata=data.suhu_rata,
        suhu_max=data.suhu_max,
        is_hari_kerja=data.is_hari_kerja,
        aktual_kwh_kantor=data.aktual_kwh_kantor
    )

    # Gabungkan hasil dari kedua helper
    result = {
        **terminal_result,
        **kantor_result
    }

    logger.info(f"Hasil evaluasi: {result}")
    return result

@app.post("/evaluate/terminal", summary="Evaluasi Khusus Terminal")
def evaluate_terminal_performance(data: EvaluationInputTerminal):
    """Mengevaluasi kinerja harian khusus untuk Terminal."""
    logger.info(f"Menerima request /evaluate/terminal: {data.dict()}")
    result = _evaluate_terminal(**data.dict())
    logger.info(f"Hasil evaluasi terminal: {result}")
    return result

@app.post("/evaluate/kantor", summary="Evaluasi Khusus Kantor")
def evaluate_kantor_performance(data: EvaluationInputKantor):
    """Mengevaluasi kinerja harian khusus untuk Kantor."""
    logger.info(f"Menerima request /evaluate/kantor: {data.dict()}")
    result = _evaluate_kantor(**data.dict())
    logger.info(f"Hasil evaluasi kantor: {result}")
    return result
