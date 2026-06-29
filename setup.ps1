# Setup Script for Smart Flashcards & Quiz Generator
# This script installs Scoop, 7zip, Tesseract-OCR, and downloads required OCR language files.

Write-Host "Starting environment setup..." -ForegroundColor Cyan

# 1. Ensure Execution Policy is set
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# 2. Check and Install Scoop
if (!(Get-Command scoop -ErrorAction SilentlyContinue)) {
    Write-Host "Scoop is not installed. Installing Scoop..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
    if (!(Get-Command scoop -ErrorAction SilentlyContinue)) {
        # Try refreshing environment path
        $env:PATH += ";$env:USERPROFILE\scoop\shims"
    }
} else {
    Write-Host "Scoop is already installed." -ForegroundColor Green
}

# 3. Check and Install 7zip
Write-Host "Checking 7zip..." -ForegroundColor Cyan
& scoop install 7zip 2>&1 | Out-Null
Write-Host "7zip check complete." -ForegroundColor Green

# 4. Check and Install Tesseract-OCR
Write-Host "Installing Tesseract-OCR..." -ForegroundColor Cyan
& scoop install tesseract 2>&1 | Out-Null
Write-Host "Tesseract-OCR check complete." -ForegroundColor Green

# 5. Download language data files (eng & ara)
$tessdataDir = "$env:USERPROFILE\scoop\apps\tesseract\current\tessdata"
if (Test-Path $tessdataDir) {
    Write-Host "Downloading English language model..." -ForegroundColor Cyan
    $engPath = Join-Path $tessdataDir "eng.traineddata"
    if (!(Test-Path $engPath)) {
        Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata" -OutFile $engPath
        Write-Host "English model downloaded." -ForegroundColor Green
    } else {
        Write-Host "English model already exists." -ForegroundColor Green
    }

    Write-Host "Downloading Arabic language model..." -ForegroundColor Cyan
    $araPath = Join-Path $tessdataDir "ara.traineddata"
    if (!(Test-Path $araPath)) {
        Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata_fast/raw/main/ara.traineddata" -OutFile $araPath
        Write-Host "Arabic model downloaded." -ForegroundColor Green
    } else {
        Write-Host "Arabic model already exists." -ForegroundColor Green
    }
} else {
    Write-Warning "Could not locate Tesseract tessdata folder at $tessdataDir. Please ensure Tesseract is installed correctly."
}

Write-Host "Environment setup completed successfully!" -ForegroundColor Green
