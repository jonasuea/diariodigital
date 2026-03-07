# Este script automatiza o processo de deploy da aplicação.
# Uso: .\deploy.ps1 -m "v1.0.0" [-notes "Descrição das mudanças"]

param(
    [Parameter(Mandatory = $true)]
    [string]$m,  # Versão da release (ex: v0.0.3)

    [Parameter(Mandatory = $false)]
    [string]$notes = ""  # Notas opcionais da release
)

# --- NOVO: ATUALIZAR ARQUIVOS DE VERSÃO AUTOMATICAMENTE ---

# Extrai apenas os números da versão (ex: v0.0.3 -> 0.0.3)
$versionNumber = $m -replace '^v', ""
$currentDate = Get-Date -Format "yyyy-MM-dd"
$defaultNotes = if ($notes -ne "") { $notes } else { "Atualização do sistema." }

Write-Host "Atualizando arquivos de versão para v$versionNumber..." -ForegroundColor Cyan

# 1. Atualizar public/version.json
$versionJsonPath = "e:\Projetos_App\educafacil\public\version.json"
$newJson = @{
    version     = $versionNumber
    releaseDate = $currentDate
    notes       = $defaultNotes
} | ConvertTo-Json
$UTF8NoBOM = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($versionJsonPath, $newJson, $UTF8NoBOM)

# 2. Atualizar src/constants/version.ts
$versionTsPath = "e:\Projetos_App\educafacil\src\constants\version.ts"
$versionTsContent = "export const APP_VERSION = `"$versionNumber`";"
[System.IO.File]::WriteAllText($versionTsPath, $versionTsContent, $UTF8NoBOM)

Write-Host "Arquivos de versão atualizados com sucesso!" -ForegroundColor Cyan

# --- PASSO 1: ATUALIZAR O GITHUB ---

Write-Host "Adicionando todos os arquivos modificados ao Git..." -ForegroundColor Green
git add .

Write-Host "Fazendo commit com a mensagem: '$m'..." -ForegroundColor Green
git commit -m "$m"

# Cria uma tag Git com o nome da versão (ex: v0.0.3)
Write-Host "Criando tag '$m'..." -ForegroundColor Green
git tag "$m"

Write-Host "Enviando alterações e tag para o GitHub..." -ForegroundColor Green
git push origin master
git push origin "$m"

# Verifica se o push foi bem-sucedido antes de continuar
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sem permissão para enviar para o GitHub. Abortando o deploy." -ForegroundColor Red
    exit 1
}

# --- PASSO 2: CRIAR RELEASE NO GITHUB ---

Write-Host "Criando Release no GitHub: $m..." -ForegroundColor Cyan

# Verifica se o GitHub CLI (gh) está instalado
if (Get-Command gh -ErrorAction SilentlyContinue) {
    if ($notes -ne "") {
        gh release create "$m" --title "$m" --notes "$notes"
    }
    else {
        gh release create "$m" --title "$m" --generate-notes
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Release '$m' criada no GitHub com sucesso!" -ForegroundColor Cyan
    }
    else {
        Write-Host "Aviso: Não foi possível criar a Release no GitHub (verifique se está logado: gh auth login)." -ForegroundColor Yellow
    }
}
else {
    Write-Host "Aviso: GitHub CLI (gh) não encontrado. Instale em https://cli.github.com para criar Releases automaticamente." -ForegroundColor Yellow
}

# --- PASSO 3: PUBLICAR NO FIREBASE ---

Write-Host "Construindo a aplicação para produção (npm run build)..." -ForegroundColor Green
npm run build

# Verifica se o build foi bem-sucedido
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro durante o build. Abortando o deploy." -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando o deploy para o Firebase..." -ForegroundColor Green
firebase deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro durante o deploy para o Firebase." -ForegroundColor Red
    exit 1
}

Write-Host "Processo de deploy concluído! Release '$m' está online." -ForegroundColor Green