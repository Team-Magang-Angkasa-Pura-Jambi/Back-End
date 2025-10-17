# main.py
# Server backend FastAPI untuk melayani model machine learning alokasi dana.

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import joblib
import logging
import warnings
from sklearn.exceptions import InconsistentVersionWarning

# Mengabaikan warning versi scikit-learn saat memuat model.
warnings.filterwarnings("ignore", category=InconsistentVersionWarning)

# --- 1. Pydantic Models (Untuk Validasi Input Otomatis) ---
class PredictionInput(BaseModel):
    """Struktur data untuk endpoint /predict."""
    pax: int
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int

class EvaluationInput(BaseModel):
    """Struktur data untuk endpoint /evaluate."""
    pax: int
    suhu_rata: float
    suhu_max: float
    is_hari_kerja: int
    aktual_kwh_terminal: float
    aktual_kwh_kantor: float

# --- 2. Inisialisasi Aplikasi dan Konfigurasi ---

app = FastAPI(
    title="API Alokasi Dana Energi",
    description="API untuk prediksi dan evaluasi konsumsi energi.",
    version="2.3.0" # Versi diperbarui dengan penanganan error terpusat
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models = {}

# ==============================================================================
# PERBAIKAN: PENANGANAN ERROR TERPUSAT (GLOBAL EXCEPTION HANDLER)
# ==============================================================================
# Fungsi ini akan menangkap semua error yang tidak terduga di dalam aplikasi.
# Tujuannya adalah untuk:
# 1. Mencegah error mentah (yang 'jelek') dikirim ke klien/frontend.
# 2. Memberikan respons JSON yang konsisten dan mudah dibaca.
# 3. Mencatat detail error lengkap di server untuk kemudahan debugging.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Menangani semua error yang tidak terduga dan mengembalikan respons JSON yang bersih."""
    # Mencatat error lengkap di log server untuk developer
    logger.error(f"Terjadi error tak terduga pada request: {request.method} {request.url}", exc_info=True)
    # Mengembalikan respons JSON yang rapi ke klien
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
        'model_prediksi_terminal.pkl',
        'model_prediksi_kantor.pkl',
        'model_klasifikasi_terminal.pkl',
        'model_klasifikasi_kantor.pkl'
    ]
    try:
        for file in model_files:
            model_name = file.replace('.pkl', '')
            models[model_name] = joblib.load(file)
        logger.info("✅ Semua 4 model berhasil dimuat saat startup.")
    except FileNotFoundError as e:
        logger.error(f"❌ KRITIKAL: Gagal memuat file model: {e}. Aplikasi akan berhenti.")
        exit(1)

# --- 3. API Endpoints ---

@app.get("/")
def read_root():
    """Endpoint dasar untuk mengecek apakah API berjalan."""
    return {"status": "API Alokasi Dana Aktif"}

@app.post("/predict")
def predict_consumption(data: PredictionInput):
    """
    Membuat prediksi konsumsi kWh untuk Terminal dan Kantor.
    """
    df_prakiraan = pd.DataFrame([{
        'pax': data.pax,
        'suhu_rata': data.suhu_rata,
        'suhu_max': data.suhu_max,
        'Hari_Hari Kerja': data.is_hari_kerja
    }])

    features_terminal = ['pax', 'suhu_rata', 'suhu_max']
    features_kantor = ['suhu_rata', 'suhu_max', 'Hari_Hari Kerja']

    pred_terminal = float(models['model_prediksi_terminal'].predict(df_prakiraan[features_terminal])[0])
    pred_kantor = float(models['model_prediksi_kantor'].predict(df_prakiraan[features_kantor])[0])

    return {
        "prediksi_kwh_terminal": round(pred_terminal, 2),
        "prediksi_kwh_kantor": round(pred_kantor, 2)
    }

@app.post("/evaluate")
def evaluate_performance(data: EvaluationInput):
    """
    Mengevaluasi kinerja harian dengan metode dinamis.
    """
    logger.info(f"Menerima request /evaluate: {data.dict()}")

    df_evaluasi = pd.DataFrame([{
        'pax': data.pax,
        'suhu_rata': data.suhu_rata,
        'suhu_max': data.suhu_max,
        'Hari_Hari Kerja': data.is_hari_kerja,
    }])

    # --- Evaluasi Terminal ---
    features_terminal = ['pax', 'suhu_rata', 'suhu_max']
    pred_normal_term = float(models['model_prediksi_terminal'].predict(df_evaluasi[features_terminal])[0])
    
    deviasi_term = 0.0
    if pred_normal_term > 0:
        deviasi_term = ((data.aktual_kwh_terminal - pred_normal_term) / pred_normal_term) * 100
    
    features_klas_term = pd.DataFrame([{'pax': data.pax, 'suhu_max': data.suhu_max, 'deviasi_persen': deviasi_term}])
    klas_term_encoded = int(models['model_klasifikasi_terminal'].predict(features_klas_term)[0])

    # --- Evaluasi Kantor ---
    features_kantor = ['suhu_rata', 'suhu_max', 'Hari_Hari Kerja']
    pred_normal_kantor = float(models['model_prediksi_kantor'].predict(df_evaluasi[features_kantor])[0])

    deviasi_kantor = 0.0
    if pred_normal_kantor > 0:
        deviasi_kantor = ((data.aktual_kwh_kantor - pred_normal_kantor) / pred_normal_kantor) * 100

    features_klas_kantor = pd.DataFrame([{'Hari_Hari Kerja': data.is_hari_kerja, 'suhu_max': data.suhu_max, 'deviasi_persen_kantor': deviasi_kantor}])
    klas_kantor_encoded = int(models['model_klasifikasi_kantor'].predict(features_klas_kantor)[0])

    # Sebaiknya mapping ini disimpan dan dimuat, bukan di-hardcode
    mapping_terminal = {0: 'Boros', 1: 'Layanan Tidak Maksimal / Sangat Efisien', 2: 'Normal'}
    mapping_kantor = {0: 'Boros', 1: 'Efisien', 2: 'Normal'}
    
    # PERBAIKAN: Buat objek hasil untuk logging dan return
    result = {
        "kinerja_terminal": mapping_terminal.get(klas_term_encoded, "Label Tidak Dikenal"),
        "deviasi_persen_terminal": round(deviasi_term, 2),
        "kinerja_kantor": mapping_kantor.get(klas_kantor_encoded, "Label Tidak Dikenal"),
        "deviasi_persen_kantor": round(deviasi_kantor, 2)
    }

    # PERBAIKAN: Lakukan logging terhadap hasil evaluasi
        
    return result
