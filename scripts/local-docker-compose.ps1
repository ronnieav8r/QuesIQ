param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ComposeArgs
)

$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
$dockerApp = "C:\Program Files\Docker\Docker"

$env:PATH = "$dockerBin;$dockerApp;$env:PATH"

docker compose @ComposeArgs
exit $LASTEXITCODE
