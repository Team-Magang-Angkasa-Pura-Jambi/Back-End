# main.py

from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
import os

# --- MODEL UNTUK VALIDASI INPUT ---
# Pydantic akan otomatis memvalidasi tipe data yang masuk
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
    description="API untuk prediksi dan klasifikasi pemakaian energi.",
    version="1.0.0"
)

# Muat semua model saat aplikasi dimulai
script_dir = os.path.dirname(os.path.abspath(__file__))
model_listrik = joblib.load(os.path.join(script_dir, 'model_prediksi_listrik.joblib'))
model_pax = joblib.load(os.path.join(script_dir, 'model_prediksi_pax.joblib'))
model_air = joblib.load(os.path.join(script_dir, 'model_prediksi_air.joblib'))
model_klasifikasi = joblib.load(os.path.join(script_dir, 'model_klasifikasi.joblib'))


# --- ENDPOINT API ---
@app.post("/predict")
def predict(data: PredictionInput):
    """
    Menerima tanggal dan mengembalikan prediksi Listrik, Pax, dan Air.
    """
    target_date = pd.to_datetime(data.tanggal)
    future_df = pd.DataFrame(index=[target_date])
    future_df['month'] = future_df.index.month
    future_df['dayofweek'] = future_df.index.dayofweek
    future_df['dayofyear'] = future_df.index.dayofyear
    
    FEATURES = ['month', 'dayofweek', 'dayofyear']
    
    pred_listrik = model_listrik.predict(future_df[FEATURES])[0]
    pred_pax = model_pax.predict(future_df[FEATURES])[0]
    pred_air = model_air.predict(future_df[FEATURES])[0]
    
    return {
        'tanggal_prediksi': data.tanggal,
        'prediksi_listrik_kwh': round(pred_listrik, 2),
        'prediksi_pax': int(pred_pax),
        'prediksi_air_m3': round(pred_air, 2)
    }

@app.post("/classify")
def classify(data: ClassificationInput):
    """
    Menerima data harian dan mengembalikan klasifikasi pemakaian.
    """
    perubahan_listrik = data.kwh_today - data.kwh_yesterday
    perubahan_pax = data.pax_today - data.pax_yesterday
    
    input_features = pd.DataFrame([[perubahan_listrik, perubahan_pax]], columns=['Perubahan_Listrik', 'Perubahan_Pax'])
    
    hasil_klasifikasi = model_klasifikasi.predict(input_features)[0]

    return {
        'klasifikasi': hasil_klasifikasi,
        'input_data': {
            'perubahan_listrik_kwh': round(perubahan_listrik, 2),
            'perubahan_pax': round(perubahan_pax, 2)
        }
    }