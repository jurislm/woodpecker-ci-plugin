#!/bin/zsh -f
if [[ -r ${ZDOTDIR:-$HOME}/.zshenv ]]; then
  /bin/zsh -f -n "${ZDOTDIR:-$HOME}/.zshenv" || exit $?
  startup_status=0
  source "${ZDOTDIR:-$HOME}/.zshenv" >/dev/null || startup_status=$?
  if (( startup_status > 1 )); then
    exit "$startup_status"
  fi
fi
if [[ -z ${WOODPECKER_API_TOKEN:-} ]]; then
  print -u2 -- 'WOODPECKER_API_TOKEN is required in the zsh startup environment'
  exit 1
fi
if [[ -z ${WOODPECKER_URL:-} ]]; then
  print -u2 -- 'WOODPECKER_URL is required in the host or zsh startup environment'
  exit 1
fi
zmodload zsh/parameter
export PATH="$HOME/.bun/bin:/usr/bin:/bin"
for name in ${(k)parameters}; do
  case "$name" in
    HOME|PATH|TMPDIR|LANG|WOODPECKER_URL|WOODPECKER_API_TOKEN) ;;
    *)
      if [[ ${parameters[$name]} == *export* ]]; then
        unset "$name"
      fi
      ;;
  esac
done
exec "$HOME/.bun/bin/bunx" -y @jurislm/woodpecker-ci-plugin@latest
