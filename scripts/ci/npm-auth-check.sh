set +x
set -eu
: "${NPM_TOKEN:?NPM_TOKEN is required}"
umask 077
NPM_CONFIG_USERCONFIG=$(mktemp)
export NPM_CONFIG_USERCONFIG
trap 'rm -f "$NPM_CONFIG_USERCONFIG"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$NPM_CONFIG_USERCONFIG"
if ! identity=$(npm whoami --registry=https://registry.npmjs.org/ --loglevel=error 2>/dev/null); then
  printf 'npm authentication failed; no publication attempted\n' >&2
  exit 1
fi
test "$identity" = 'terry.ty'
printf 'npm authentication verified for terry.ty; no publication attempted\n'
