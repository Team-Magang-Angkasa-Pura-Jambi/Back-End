# scripts/Dockerfile

# Gunakan base image resmi Python
FROM python:3.10-slim

# Set working directory di dalam container
WORKDIR /app

# Salin file requirements dan instal library
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin semua file dari folder scripts (main.py dan .joblib)
COPY . .

# Perintahkan container untuk menjalankan server FastAPI saat dimulai
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]