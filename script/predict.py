# app.py

import sys
import json
import pandas as pd
import joblib
import os

# --- PATH SETUP ---
# Tentukan path absolut ke direktori skrip ini
script_dir = os.path.dirname(os.path.abspath(__file__))

# --- FUNGSI PREDIKSI ---
def predict_for_date(target_date_str):
    try:
        model_listrik = joblib.load(os.path.join(script_dir, 'model_prediksi_listrik.joblib'))
        model_pax = joblib.load(os.path.join(script_dir, 'model_prediksi_pax.joblib'))
        model_air = joblib.load(os.path.join(script_dir, 'model_prediksi_air.joblib'))

        target_date = pd.to_datetime(target_date_str)
        future_df = pd.DataFrame(index=[target_date])
        future_df['month'] = future_df.index.month
        future_df['dayofweek'] = future_df.index.dayofweek
        future_df['dayofyear'] = future_df.index.dayofyear
        
        FEATURES = ['month', 'dayofweek', 'dayofyear']
        
        pred_listrik = model_listrik.predict(future_df[FEATURES])[0]
        pred_pax = model_pax.predict(future_df[FEATURES])[0]
        pred_air = model_air.predict(future_df[FEATURES])[0]
        
        return {
            'tanggal_prediksi': target_date_str,
            'prediksi_listrik_kwh': round(pred_listrik, 2),
            'prediksi_pax': int(pred_pax),
            'prediksi_air_m3': round(pred_air, 2)
        }
    except Exception as e:
        return {'error': str(e)}

# --- FUNGSI KLASIFIKASI ---
def classify_usage(kwh_today, kwh_yesterday, pax_today, pax_yesterday):
    try:
        model_klasifikasi = joblib.load(os.path.join(script_dir, 'model_klasifikasi.joblib'))

        perubahan_listrik = float(kwh_today) - float(kwh_yesterday)
        perubahan_pax = float(pax_today) - float(pax_yesterday)

        # Buat dataframe 2D untuk input model
        input_features = pd.DataFrame([[perubahan_listrik, perubahan_pax]], columns=['Perubahan_Listrik', 'Perubahan_Pax'])
        
        # Lakukan klasifikasi
        hasil_klasifikasi = model_klasifikasi.predict(input_features)[0]

        return {
            'klasifikasi': hasil_klasifikasi,
            'input_data': {
                'perubahan_listrik_kwh': round(perubahan_listrik, 2),
                'perubahan_pax': round(perubahan_pax, 2)
            }
        }
    except Exception as e:
        return {'error': str(e)}

# --- MAIN LOGIC ---
if __name__ == '__main__':
    # Argumen pertama adalah mode: 'predict' atau 'classify'
    mode = sys.argv[1] if len(sys.argv) > 1 else None

    if mode == 'predict':
        if len(sys.argv) > 2:
            input_date = sys.argv[2]
            result = predict_for_date(input_date)
            print(json.dumps(result))
        else:
            print(json.dumps({'error': 'Mode "predict" membutuhkan tanggal.'}))

    elif mode == 'classify':
        if len(sys.argv) > 5:
            # Ambil 4 angka sebagai input
            kwh_d = sys.argv[2]
            kwh_d1 = sys.argv[3]
            pax_d = sys.argv[4]
            pax_d1 = sys.argv[5]
            result = classify_usage(kwh_d, kwh_d1, pax_d, pax_d1)
            print(json.dumps(result))
        else:
            print(json.dumps({'error': 'Mode "classify" membutuhkan 4 input: kwh_today, kwh_yesterday, pax_today, pax_yesterday.'}))
    
    else:
        print(json.dumps({'error': 'Mode tidak valid. Gunakan "predict" atau "classify".'}))