# main.py

from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
import os
import warnings
from sklearn.exceptions import InconsistentVersionWarning

# PERBAIKAN: Abaikan InconsistentVersionWarning dari scikit-learn
# Ini adalah solusi sementara. Sebaiknya, latih ulang model dengan versi scikit-learn yang sama.
warnings.filterwarnings("ignore", category=InconsistentVersionWarning)

# --- MODEL UNTUK VALIDASI INPUT OTOMATIS ---
class PredictionInput(BaseModel):
    tanggal: str # Format "YYYY-MM-DD"

class ClassificationInput(BaseModel):
    kwh_today: float
    kwh_yesterday: float
    pax_today: float
    pax_yesterday: float

# --- INISIALISASI APLIKASI & MUAT MODEL ---
app = FastAPI(
    title="API Prediksi Energi",
    description="API untuk prediksi pemakaian energi.",
    version="1.0.0"
)

# PERBAIKAN: Deklarasikan variabel model di luar try-except
model_listrik = None
model_pax = None
model_air = None
model_klasifikasi = None

# Muat semua model saat aplikasi dimulai
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_listrik = joblib.load(os.path.join(script_dir, 'model_prediksi_listrik.joblib'))
    model_pax = joblib.load(os.path.join(script_dir, 'model_prediksi_pax.joblib'))
    model_air = joblib.load(os.path.join(script_dir, 'model_prediksi_air.joblib'))
    # PERBAIKAN: Sesuaikan nama file dengan file model yang sebenarnya.
    model_klasifikasi = joblib.load(os.path.join(script_dir, 'model_efisiensi.joblib'))
    print(">>> Semua model prediksi berhasil dimuat.")
except Exception as e:
    # PERBAIKAN: Jika model gagal dimuat, hentikan aplikasi.
    print(f"XXX KRITIKAL: Gagal memuat file model. Aplikasi akan berhenti. Error: {e}")
    exit(1)

# --- ENDPOINT API (URL) ---
@app.post("/predict")
def predict(data: PredictionInput):
    """
    Menerima tanggal dan mengembalikan prediksi Listrik, Pax, dan Air.
    """
    # PERBAIKAN: Pastikan model sudah dimuat
    if not all([model_listrik, model_pax, model_air]):
        return {"error": "Satu atau lebih model prediksi tidak berhasil dimuat. Silakan cek log server."}

    try:
        target_date = pd.to_datetime(data.tanggal)
        future_df = pd.DataFrame(index=[target_date])
        future_df['month'] = future_df.index.month
        future_df['dayofweek'] = future_df.index.dayofweek
        future_df['dayofyear'] = future_df.index.dayofyear
        
        FEATURES = ['month', 'dayofweek', 'dayofyear']
        
        # Lakukan prediksi untuk setiap variabel
        pred_listrik = model_listrik.predict(future_df[FEATURES])[0]
        pred_pax = model_pax.predict(future_df[FEATURES])[0]
        pred_air = model_air.predict(future_df[FEATURES])[0]
        
        # Kembalikan hasil dalam format JSON
        return {
            'tanggal_prediksi': data.tanggal,
            'prediksi_listrik_kwh': round(pred_listrik, 2),
            'prediksi_pax': int(pred_pax),
            'prediksi_air_m3': round(pred_air, 2)
        }
    except Exception as e:
        return {"error": f"Terjadi kesalahan saat prediksi: {str(e)}"}

@app.post("/classify")
def classify(data: ClassificationInput):
    """
    Menerima data harian dan mengembalikan klasifikasi pemakaian.
    """
    # PERBAIKAN: Pastikan model sudah dimuat
    if not model_klasifikasi:
        return {"error": "Model klasifikasi tidak berhasil dimuat. Silakan cek log server."}

    # PERBAIKAN: Tambahkan blok try-except untuk penanganan error yang lebih baik.
    try:
        perubahan_listrik = data.kwh_today - data.kwh_yesterday
        perubahan_pax = data.pax_today - data.pax_yesterday
        
        # PERBAIKAN: Gunakan nama kolom yang sama persis seperti saat pelatihan model.
        # Nama kolom sensitif terhadap huruf besar/kecil.
        input_features = pd.DataFrame([[perubahan_listrik, perubahan_pax]], 
                                      columns=['perubahan_listrik', 'perubahan_penumpang'])
        
        hasil_klasifikasi = model_klasifikasi.predict(input_features)[0]

        return {
            'klasifikasi': hasil_klasifikasi,
            'input_data': {
                'perubahan_listrik_kwh': round(perubahan_listrik, 2),
                'perubahan_pax': round(perubahan_pax, 2)
            }
        }
    except Exception as e:
        # Selalu kembalikan respons JSON yang valid, bahkan saat error.
        return {"error": f"Terjadi kesalahan saat klasifikasi: {str(e)}"}