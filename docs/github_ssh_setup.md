# GitHub SSH Setup (statt PAT)

Ziel: Git-Push/Pull dauerhaft ohne ablaufende Personal Access Tokens (PAT) nutzen.

## 1) SSH-Key lokal erzeugen

```bash
ssh-keygen -t ed25519 -C "dein-user@github" -f ~/.ssh/id_ed25519 -N ""
```

Ergebnis:
- privater Key: `~/.ssh/id_ed25519`
- public Key: `~/.ssh/id_ed25519.pub`

## 2) Public Key in GitHub hinterlegen

GitHub:
- `Settings -> SSH and GPG keys -> New SSH key`

Felder:
- `Title`: z. B. `MacBook wohnlagencheck24`
- `Key type`: `Authentication Key`
- `Key`: Inhalt aus `~/.ssh/id_ed25519.pub`

Public Key anzeigen:

```bash
cat ~/.ssh/id_ed25519.pub
```

## 3) Repo-Remote auf SSH umstellen

Im Projekt-Repo:

```bash
git remote set-url origin git@github.com:eisenlars/wohnlagencheck24.git
git remote -v
```

## 4) Host-Key und Agent vorbereiten

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
ssh-add -l
```

## 5) Verbindung testen

```bash
ssh -T git@github.com
```

Erwartung:
- `Hi <github-user>! You've successfully authenticated, but GitHub does not provide shell access.`

## 6) Git testen

```bash
git pull
git push
```

## Fehlerbilder

- `Permission denied (publickey)`:
  - Public Key noch nicht in GitHub hinterlegt, oder falscher Account.
- `Host key verification failed`:
  - `known_hosts`-Eintrag fehlt (`ssh-keyscan` aus Schritt 4).
- `Could not resolve hostname github.com`:
  - Netzwerk/DNS-Problem lokal oder in Sandbox.
