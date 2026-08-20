export interface SinglePredictionPayload {
  meter_id: number;
  date: string; // "YYYY-MM-DD"
  suhu_rata?: number;
  suhu_max?: number;
}

export interface BulkPredictionPayload {
  meter_id: number;
  start_date: string; // "YYYY-MM-DD"
  end_date: string; // "YYYY-MM-DD"
  suhu_rata?: number;
  suhu_max?: number;
}

export interface MlApiPredictionItem {
  tanggal: string;
  prediksi_pax: number;
  terminal: {
    prediksi_kwh: number;
  };
  kantor: {
    prediksi_kwh: number;
  };
}

export interface PredictionQuery {
  meter_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}
