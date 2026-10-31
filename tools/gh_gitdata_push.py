"""
GitHub 源码推送（Git Data API 版）
=================================
背景：github.com:443 在本机网络被封锁，git push/fetch 直连不可用；
api.github.com 可达。因此源码上传走 Git Data API：
基于 GitHub 线上 main 的当前 commit，把本地文件的新内容重建为 blob/tree/commit，
再更新 refs/heads/main（fast-forward，不 force）。

与本地 main 历史线是否分叉无关（API 按"内容"重建，不依赖本地 hash）。

用法：
  $env:GITHUB_TOKEN='github_pat_xxx'   # 必填，勿硬编码进脚本
  python tools/gh_gitdata_push.py [base_sha]   # base_sha 可选，缺省自动取 GitHub main 当前 sha

注意事项：
- FILES 列表：每次发版手动维护为"本次要发布到 GitHub 的文件路径（相对仓库根）"，
  读取的是【本地工作区当前内容】。新增文件路径需在此列出。
- 只做 fast-forward（PATCH ref 时 force=false）；若远程 main 被他人推进会失败，需先核对。
- 文本文件请保持 UTF-8 无 BOM。
"""
import json, base64, os, sys, urllib.request

TOK = os.environ.get('GITHUB_TOKEN', '')
if not TOK:
    raise SystemExit('请先设置环境变量 GITHUB_TOKEN')
OWNER, REPO = 'xunwulove', 'JiyueJie'
BASE = f'https://api.github.com/repos/{OWNER}/{REPO}'
HEAD = {'Authorization': f'Bearer {TOK}', 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'}

# 本次要发布到 GitHub 的文件（相对仓库根；读取本地工作区当前内容）
# 覆盖 0.6.4 之后 7 个 commit 的全部改动（digest 透传 / 歌单可用率收紧 / 可用率中性 / 首页四卡 / 我的页与每日推荐 / 排序标签翻转 / 备份全量）
FILES = [
    'src/pages/home/components/homeBody/recommendSection.tsx',
    'src/pages/recommendSheets/index.tsx',
    'src/core/pluginRecommend.ts',
    'src/components/dialogs/components/pluginReliabilityDialog.tsx',
    'src/core/pluginReliability.ts',
    'src/pages/home/components/homeBody/operations.tsx',
    'src/pages/home/components/mineTab.tsx',
    'src/pages/home/components/libraryTab.tsx',
    'src/core/backup.ts',
    'src/core/i18n/languages/zh-cn.json',
    'src/core/i18n/languages/zh-tw.json',
    'src/pages/setting/settingTypes/backupSetting.tsx',
    'src/types/core/i18n/index.d.ts',
]
COMMIT_MSG = '''feat: 0.6.4 之后一批修复与优化（不升版本重发）

- fix(recommend): 标签传递保留 digest 等插件字段，修复念心等源歌单拉不出
- fix(recommend): 推荐歌单可用率真实使用侧收紧为显示+首曲可解析 8s 超时，对齐探测口径
- fix(reliability): 合成可用率缺失维度改中性值 0.5 填充，防单维度独占虚高
- feat(home): 首页四入口卡标题手机版统一每行两字，平板保持单行
- feat(home): 每日推荐卡片标题两字换行、我的页手机版去除设备型号与系统版本
- feat(library): 点击当前排序类目标签直接切换升/降序
- feat(backup): 全量插件含禁用状态备份、恢复前预览校验、sha256 校验、WebDAV 保留最近 5 份'''


def api(method, url, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers=HEAD)
    try:
        r = urllib.request.urlopen(req, timeout=120)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print('HTTP ERROR', method, url.split('?')[0], e.code, e.read().decode()[:300])
        raise


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根（tools/..）
    ref = api('GET', f'{BASE}/git/ref/heads/main')
    base_sha = sys.argv[1] if len(sys.argv) > 1 else ref['object']['sha']
    print('base main sha:', base_sha)

    blob_shas = {}
    for fp in FILES:
        with open(os.path.join(root, fp), 'rb') as f:
            content = f.read()
        b = api('POST', f'{BASE}/git/blobs',
                {'content': base64.b64encode(content).decode(), 'encoding': 'base64'})
        blob_shas[fp] = b['sha']
        print('blob', fp, b['sha'][:10])

    commit = api('GET', f'{BASE}/git/commits/{base_sha}')
    base_tree = commit['tree']['sha']
    entries = [{'path': fp, 'mode': '100644', 'type': 'blob', 'sha': blob_shas[fp]}
               for fp in FILES]
    tree = api('POST', f'{BASE}/git/trees', {'base_tree': base_tree, 'tree': entries})
    print('new tree:', tree['sha'][:10])

    new_commit = api('POST', f'{BASE}/git/commits',
                     {'message': COMMIT_MSG, 'tree': tree['sha'], 'parents': [base_sha]})
    print('new commit:', new_commit['sha'])

    api('PATCH', f'{BASE}/git/refs/heads/main', {'sha': new_commit['sha'], 'force': False})
    print('PUSHED OK', new_commit['sha'])


if __name__ == '__main__':
    main()
