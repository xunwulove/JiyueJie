import json, re, subprocess, sys, time, urllib.request, urllib.parse, uuid, os

REPO = "xunwulove/jiyuejie"
BASE = "https://gitee.com/api/v5/repos/" + REPO

def get_token():
    out = subprocess.check_output(["git", "-C", r"E:\xunwu\Deepseek\jiyuejie", "remote", "get-url", "gitee"], text=True, encoding="utf-8", errors="replace")
    m = re.search(r"https://[^:]+:([^@]+)@", out)
    return m.group(1).strip()

TOKEN = get_token()

def _open(req, timeout):
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return -1, str(e)

def api_delete(path):
    url = BASE + path + "?access_token=" + TOKEN
    return _open(urllib.request.Request(url, method="DELETE"), 60)

def api_create_release(tag, name, body_text):
    boundary = uuid.uuid4().hex
    fields = {"access_token": TOKEN, "tag_name": tag, "target_commitish": "master", "name": name, "body": body_text}
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8")
    body += f"--{boundary}--\r\n".encode("utf-8")
    req = urllib.request.Request(BASE + "/releases", method="POST", data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    return _open(req, 90)

def upload(release_id, filepath, filename):
    boundary = uuid.uuid4().hex
    with open(filepath, "rb") as f:
        filebytes = f.read()
    body = b""
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode("utf-8")
    body += filebytes + b"\r\n"
    body += f"--{boundary}--\r\n".encode("utf-8")
    url = f"{BASE}/releases/{release_id}/attach_files?access_token={TOKEN}&name={filename}"
    req = urllib.request.Request(url, method="POST", data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    return _open(req, 240)

def get_release_id(tag):
    url = f"{BASE}/releases/tags/{tag}?access_token={TOKEN}"
    st, body = _open(urllib.request.Request(url), 60)
    if st == 200:
        return json.loads(body).get("id")
    return None

def main():
    log = []
    def L(m):
        print(m, flush=True)
        log.append(m)

    for tag in ("v0.6.4", "latest"):
        rid = get_release_id(tag)
        if rid:
            st, b = api_delete(f"/releases/{rid}")
            L(f"DEL release {tag} id={rid} -> {st}")
        else:
            L(f"release {tag} not found, skip")
        st, b = api_delete("/tags/" + urllib.parse.quote(tag))
        L(f"DEL tag {tag} -> {st}")

    vj_path = r"E:\xunwu\Deepseek\jiyuejie\updates\version.json"
    apk_dir = r"E:\xunwu\Deepseek\jiyuejie\android\app\build\outputs\apk\release"
    with open(vj_path, "r", encoding="utf-8") as f:
        vj = json.load(f)
    body_text = "\n".join(vj.get("changeLog", []))

    for tag, name, files in (
        ("v0.6.4", "极悦界 0.6.4", [("version.json", vj_path), ("app-arm64-v8a-release.apk", os.path.join(apk_dir, "app-arm64-v8a-release.apk")), ("app-universal-release.apk", os.path.join(apk_dir, "app-universal-release.apk"))]),
        ("latest", "极悦界 v0.6.4 (latest)", [("version.json", vj_path)]),
    ):
        st, b = api_create_release(tag, name, body_text)
        L(f"CREATE {tag} -> {st}")
        if st in (200, 201):
            new_id = json.loads(b).get("id")
            for fn, fp in files:
                st2, b2 = upload(new_id, fp, fn)
                L(f"UPLOAD {tag}/{fn} -> {st2}")
            time.sleep(2)
        else:
            L(f"CREATE {tag} FAILED: {b[:300]}")

    urls = [
        "https://gitee.com/xunwulove/jiyuejie/releases/download/v0.6.4/app-arm64-v8a-release.apk",
        "https://gitee.com/xunwulove/jiyuejie/releases/download/v0.6.4/app-universal-release.apk",
        "https://gitee.com/xunwulove/jiyuejie/releases/download/v0.6.4/version.json",
        "https://gitee.com/xunwulove/jiyuejie/releases/download/latest/version.json",
    ]
    for u in urls:
        st, b = _open(urllib.request.Request(u, method="HEAD"), 60)
        L(f"VERIFY {u.rsplit('/', 1)[-1]} ({u.split('/download/')[-1]}) -> {st}")

    with open(r"E:\xunwu\Deepseek\jiyuejie\_refresh_log.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(log))

main()
