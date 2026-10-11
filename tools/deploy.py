#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cangame v2（4 阵营经济-战争博弈）· 同步脚本：把本地改动推到 GitHub（走本机 git + GitHub 凭据，不需要令牌）。

用法:
  python tools/deploy.py                     # 推两个仓库（源码 + Pages）
  python tools/deploy.py --only=source       # 只推源码仓库 WXZSTUDIO/cangame
  python tools/deploy.py --only=pages        # 只推 Pages 仓库 WXZSTUDIO/wxzstudio.github.io 的 /cangame/
  python tools/deploy.py --msg="说明"        # 自定义提交信息

目标:
  1) WXZSTUDIO/cangame              源码仓库（根目录）
  2) WXZSTUDIO/wxzstudio.github.io   线上 Pages 路径 /cangame/

重要:
  本脚本必须放在 cangame/tools/ 下——ROOT 由「脚本所在目录的上一级」推导，
  放错位置（如 legacy/tools/）会导致 ROOT 解析为 cangame/legacy，推错内容。

  本地不推的大目录（SKIP_DIRS）：legacy/（旧人生模拟器备份，3MB）、production/（美术原图，24MB）。
  仓库只留可部署代码 + 文档 + 测试脚本。

首次运行会在 .sync/ 下建缓存克隆，之后增量推送。
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.sync')

# 发布到 Pages 的文件清单（仅 Pages 用；源码仓库走整树同步）
PUBLISH = [
    'index.html',
    'assets/style.css',
    'assets/config.js',
    'assets/rng.js',
    'assets/state.js',
    'assets/factions.js',
    'assets/resource.js',
    'assets/ai.js',
    'assets/leader.js',
    'assets/production.js',
    'assets/economy.js',
    'assets/war.js',
    'assets/settle.js',
    'assets/engine.js',
    'assets/ui.js',
]

TARGETS = [
    # (仓库, 远端子目录 '' 表示根目录)
    ('WXZSTUDIO/cangame', ''),
    ('WXZSTUDIO/wxzstudio.github.io', 'cangame'),
]

# 同步整树时跳过的目录：大文件/备份/缓存，不上 GitHub
SKIP_DIRS = {'.git', '.sync', '__pycache__', '.workbuddy',
             'legacy', 'production'}


def run(args, cwd=None, check=False, quiet=True):
    env = dict(os.environ)
    # 关键：禁止一切交互式凭据弹窗，否则 git 会卡在 GCM 授权上直到超时
    env['GIT_TERMINAL_PROMPT'] = '0'
    env['GCM_INTERACTIVE'] = 'never'
    env['GIT_CREDENTIAL_MANAGER_INTERACTIVE'] = 'never'
    env['GIT_ASKPASS'] = 'echo'
    env['SSH_ASKPASS'] = 'echo'
    p = subprocess.run(args, cwd=cwd, env=env,
                       capture_output=True, text=True, timeout=600)
    if check and p.returncode != 0:
        raise SystemExit('命令失败: %s\n%s\n%s' % (' '.join(args), p.stdout, p.stderr))
    if not quiet:
        print(p.stdout)
    return p


def ensure_clone(repo, sub=''):
    """浅克隆并按需稀疏检出，避免整仓下载（主站仓库体积很大）"""
    url = f'https://github.com/{repo}.git'
    path = os.path.join(CACHE, repo.split('/')[1])
    if os.path.isdir(os.path.join(path, '.git')):
        run(['git', 'fetch', '--depth', '1', 'origin'], cwd=path, check=True)
        run(['git', 'reset', '--hard', 'origin/HEAD'], cwd=path, check=True)
        return path
    os.makedirs(path, exist_ok=True)
    if sub:
        run(['git', 'clone', '--depth', '1', '--filter=blob:none', '--sparse', url, path], check=True)
        run(['git', 'sparse-checkout', 'set', sub], cwd=path, check=True)
    else:
        run(['git', 'clone', '--depth', '1', url, path], check=True)
    run(['git', 'config', 'user.email', 'ro3eandcat@gmail.com'], cwd=path)
    run(['git', 'config', 'user.name', 'WXZ STUDIO'], cwd=path)
    return path


def sync(repo, sub, msg):
    print(f'==> {repo}' + (f'  (/{sub})' if sub else '  (根目录)'))
    path = ensure_clone(repo, sub)
    dest_root = os.path.join(path, sub) if sub else path

    if sub:
        for rel in PUBLISH:
            src = os.path.join(ROOT, rel)
            if not os.path.exists(src):
                continue
            dst = os.path.join(dest_root, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
        run(['git', 'add', '-A', sub], cwd=path, check=True)
    else:
        for entry in os.listdir(ROOT):
            if entry in SKIP_DIRS or entry in {'.git', '.sync', '.gh_token'}:
                continue
            src = os.path.join(ROOT, entry)
            dst = os.path.join(path, entry)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True,
                                ignore=shutil.ignore_patterns('.git', '__pycache__'))
            else:
                shutil.copyfile(src, dst)
        run(['git', 'add', '-A'], cwd=path, check=True)

    diff = run(['git', 'diff', '--cached', '--name-only'], cwd=path)
    changed = [x for x in (diff.stdout or '').splitlines() if x.strip()]
    if not changed:
        print('  = 无变动，跳过提交')
        return True

    for c in changed:
        print('  · ' + c)
    run(['git', 'commit', '-q', '-m', msg], cwd=path, check=True)
    p = run(['git', 'push', 'origin', 'HEAD:main'], cwd=path)
    if p.returncode != 0:
        print('  ✗ 推送失败: ' + (p.stderr or '')[:400])
        return False
    print('  ✓ 已推送 %d 个文件' % len(changed))
    return True


def main():
    msg = 'chore: 同步 cangame v2 改动'
    only = 'both'
    for a in sys.argv[1:]:
        if a.startswith('--msg='):
            msg = a[6:]
        elif a.startswith('--only='):
            only = a[7:]
    ok = True
    for repo, sub in TARGETS:
        if only == 'source' and sub != '':
            continue
        if only == 'pages' and sub == '':
            continue
        ok = sync(repo, sub, msg) and ok
    print('全部同步完成' if ok else '存在失败项')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
