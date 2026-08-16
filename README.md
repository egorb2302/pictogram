## Pictogram creator

Type a nickname, get four creatures, pick one, download it. The same nickname
always makes the same four: each one is a monster drawn from a SHA-256 hash of
the name plus one of four salts, so the first four characters of that hash work
as the creature's code.

This ultra-mini-app was created just for practice with Docker tools.

### Run it

```bash
docker-compose up --build
```

Then open <http://localhost:5000>. Two containers come up: the Flask app on port
5000 and `dnmonster`, which draws the creatures, on 8080.

### Routes

| Route | What it gives back |
| --- | --- |
| `GET /` | The page |
| `GET /api/creatures?name=<nickname>` | Four hashes and their codes, as JSON |
| `GET /monster/<hash>?size=<32..512>` | The creature as a PNG |
