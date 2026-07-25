FROM python:3.10-slim

WORKDIR /app

# System deps needed by Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl gnupg2 ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libxshmfence1 libx11-xcb1 \
    fonts-liberation libappindicator3-1 lsb-release xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright + Chromium (browser + all system deps)
RUN pip install playwright pytesseract pillow
RUN playwright install chromium --with-deps

COPY . .

ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "server.py"]
