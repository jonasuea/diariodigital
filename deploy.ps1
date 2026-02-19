# Este script automatiza o processo de deploy da aplicação.
# Ele executa todos os passos necessários para colocar suas alterações online.

param(
  # Define um parâmetro obrigatório '-m' para a mensagem do commit.
  [Parameter(Mandatory=$true)]
  [string]$m
)

# --- PASSO 1: ATUALIZAR O GITHUB ---

Write-Host "Adicionando todos os arquivos modificados ao Git..." -ForegroundColor Green
git add .

Write-Host "Fazendo commit com a mensagem: '$m'..." -ForegroundColor Green
git commit -m "$m"

Write-Host "Enviando alterações para o GitHub..." -ForegroundColor Green
git push origin master

# Verifica se o push foi bem-sucedido antes de continuar
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao enviar para o GitHub. Abortando o deploy." -ForegroundColor Red
    exit 1
}

# --- PASSO 2: PUBLICAR NO FIREBASE ---

Write-Host "Construindo a aplicação para produção (npm run build)..." -ForegroundColor Green
npm run build

# Verifica se o build foi bem-sucedido
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro durante o build. Abortando o deploy." -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando o deploy para o Firebase Hosting..." -ForegroundColor Green
firebase deploy

Write-Host "✅ Processo de deploy concluído! Suas alterações estão online." -ForegroundColor Green
