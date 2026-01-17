# scripts/Dockerfile

FROM python:3.10-slim

# 1. PENTING: Agar log Python muncul REAL-TIME di terminal/Railway
# Tanpa ini, log sering "nyangkut" (buffer), jadi kalau error Anda tidak langsung tahu.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 2. PENTING: Memberi tahu Railway/Docker port mana yang dipakai
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]