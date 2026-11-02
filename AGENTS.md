# Working notes for this repository

## Show a live preview, always

The owner asked, in Persian: «همیشه لایو نشون بده که بتونم ببینم» — always show it live so I can see it.

So: keep a dev server running on **port 5173** for the whole session, and restart it in the same turn if it
has died. Do not finish a turn with the preview down, and do not wait to be asked.

```
npx vite --host 0.0.0.0 --port 5173
```

- Bind to `0.0.0.0`, never `127.0.0.1`: the preview is proxied from the owner's browser, not served from this
  sandbox.
- The server is a long-lived background process, not a `bash` command.
- Vite reloads on its own as files change, so a running server shows each edit without a restart. A restart is
  only needed when the process itself is gone.
- After starting it, check it actually answers (`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/`)
  rather than assuming.
