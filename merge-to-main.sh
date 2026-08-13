#!/usr/bin/env bash
#
# merge-to-main.sh
# 将「当前分支」安全合并到 main 分支。
#
# 流程：
#   1. 记录当前分支名
#   2. 检查仓库状态与工作区是否干净
#   3. 切换到 main 并拉取最新代码（失败不自动解决，直接中止）
#   4. 将当前分支合并进 main
#   5. 若产生冲突 → 明确提示用户手动解决并退出（保留合并现场）
#   6. 合并成功后 → 询问是否推送 main 到远程
#
# 用法：
#   ./merge-to-main.sh            # 交互式（会询问是否推送）
#   ./merge-to-main.sh --push     # 合并成功后自动推送 main
#   ./merge-to-main.sh --no-push  # 合并成功后不推送（默认）
#
# 说明：脚本默认失败即中止（不会留下半成品提交），冲突时保留现场等待人工处理。

# 仅启用 pipefail，刻意不启用 -u（nounset）。
# 原因：macOS 自带 bash 为 3.2，在 set -u 下，对「含中文(多字节) + 多个 $变量
# 的双引号字符串」做词法展开时会误报 "unbound variable"（且报错变量名是乱指的），
# 属已知缺陷。脚本已通过显式校验（die / [ -n ] / ${VAR:-default}）保证安全，无需 -u。
set -o pipefail  # 不启用 -e，因为 merge 冲突是「预期内的可控退出」

# ---------- 颜色（便于阅读）----------
if [ -t 1 ]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_CYN=$'\033[36m'; C_BLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YEL=""; C_CYN=""; C_BLD=""; C_RST=""
fi

info()  { echo "${C_CYN}[信息]${C_RST} $*"; }
ok()    { echo "${C_GRN}[完成]${C_RST} $*"; }
warn()  { echo "${C_YEL}[警告]${C_RST} $*"; }
err()   { echo "${C_RED}[错误]${C_RST} $*"; }
die()   { err "$*"; exit 1; }

# ---------- 参数解析 ----------
PUSH_MODE="ask"   # ask | yes | no
for arg in "$@"; do
  case "$arg" in
    --push)    PUSH_MODE="yes" ;;
    --no-push) PUSH_MODE="no" ;;
    -h|--help) sed -n '3,22p' "$0"; exit 0 ;;
    *) die "未知参数: $arg（仅支持 --push / --no-push / -h）" ;;
  esac
done

# ---------- 0. 基础检查 ----------
command -v git >/dev/null 2>&1 || die "未检测到 git，请先安装。"

# 必须在 git 仓库内
git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "当前目录不是 git 仓库。"

# 目标分支（可配置，默认 main）
TARGET_BRANCH="${TARGET_BRANCH:-main}"

# 记录当前分支
CURRENT_BRANCH="$(git symbolic-ref --short -q HEAD 2>/dev/null)"
[ -n "$CURRENT_BRANCH" ] || die "无法获取当前分支（处于分离 HEAD 状态？）。"

info "当前分支: ${C_BLD}$CURRENT_BRANCH${C_RST}"
info "目标分支: ${C_BLD}$TARGET_BRANCH${C_RST}"

# 当前已是目标分支 → 无意义操作
if [ "$CURRENT_BRANCH" = "$TARGET_BRANCH" ]; then
  die "当前已在 $TARGET_BRANCH 上，无需合并自己。请先切换到要合并进来的特性分支。"
fi

# 远程是否存在？用于后续 pull / push 判断
REMOTE=""
if git remote get-url origin >/dev/null 2>&1; then
  REMOTE="origin"
fi

# ---------- 1. 工作区干净性检查 ----------
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  err "工作区存在未提交的修改（含暂存与未暂存）。"
  echo "  可选项："
  echo "    a) 先 git stash 暂存，合并完成后再 git stash pop"
  echo "    b) 先 git commit 提交，保持工作区干净"
  die "请处理完未提交修改后重试，避免合并时相互干扰。"
fi
ok "工作区干净，无未提交修改。"

# ---------- 2. 切换到目标分支 ----------
info "切换到 $TARGET_BRANCH ..."
if ! git checkout "$TARGET_BRANCH"; then
  die "切换分支失败（可能存在未跟踪文件冲突）。请检查后重试。"
fi

# ---------- 3. 拉取最新代码 ----------
if [ -n "$REMOTE" ]; then
  info "从 $REMOTE/$TARGET_BRANCH 拉取最新代码 ..."
  if ! git pull --ff-only "$REMOTE" "$TARGET_BRANCH"; then
    err "拉取失败或存在非快进冲突。"
    echo "  可尝试："
    echo "    git fetch $REMOTE && git merge --ff-only $REMOTE/$TARGET_BRANCH"
    echo "  或与团队成员确认 $TARGET_BRANCH 的提交历史。"
    # 切回原分支，避免留在半切换状态
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    die "已中止；已切回 $CURRENT_BRANCH。"
  fi
  ok "已更新到最新代码。"
else
  warn "未检测到 origin 远程，跳过拉取步骤（仍可本地合并）。"
fi

# ---------- 4. 合并当前分支 ----------
info "将「$CURRENT_BRANCH」合并进「$TARGET_BRANCH」..."
if git merge "$CURRENT_BRANCH" --no-edit; then
  # 合并命令成功返回，但还需确认没有残留冲突标记
  if git diff --name-only --diff-filter=U | grep -q .; then
    :
  else
    ok "合并成功，无冲突。"
  fi
else
  # merge 返回非零：可能是冲突，也可能是其它错误
  if [ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
    CONFLICT_FILES="$(git diff --name-only --diff-filter=U)"
    err "合并过程中产生冲突，已暂停合并状态等待你处理。"
    echo ""
    echo "${C_BLD}需要手动解决的冲突文件：${C_RST}"
    echo "$CONFLICT_FILES" | sed 's/^/    - /'
    echo ""
    echo "处理步骤："
    echo "  1. 编辑上述文件，解决 <<<<<<< / ======= / >>>>>>> 冲突标记"
    echo "  2. git add <已解决的文件>"
    echo "  3. git commit            # 完成这次合并提交"
    echo "  4. （可选）运行本脚本的推送步骤，或自行 git push"
    echo ""
    echo "若想放弃本次合并："
    echo "    git merge --abort"
    echo ""
    die "已保留合并现场，请在解决冲突后继续。未做任何自动提交或推送。"
  else
    err "合并失败（非冲突原因，例如其它 git 错误）。"
    git merge --abort >/dev/null 2>&1 || true
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    die "已中止并回滚合并，已切回 $CURRENT_BRANCH。"
  fi
fi

# 兜底：再次确认没有未解决的冲突（以防 --no-edit 与冲突标记并存）
if git diff --name-only --diff-filter=U | grep -q .; then
  err "检测到未解决冲突，请按上文步骤处理。"
  die "已中止。"
fi

ok "分支「$CURRENT_BRANCH」已成功合并到「$TARGET_BRANCH」。"

# ---------- 5. 可选：推送 main 到远程 ----------
maybe_push() {
  if [ -z "$REMOTE" ]; then
    warn "无 origin 远程，跳过推送。"
    return 0
  fi
  info "准备推送 $TARGET_BRANCH 到 $REMOTE ..."
  if git push "$REMOTE" "$TARGET_BRANCH"; then
    ok "已推送 $TARGET_BRANCH 到 $REMOTE。"
  else
    err "推送失败（可能被拒绝，需先 pull 或确认权限）。"
    echo "  可手动执行：git push $REMOTE $TARGET_BRANCH"
    return 1
  fi
}

case "$PUSH_MODE" in
  yes) maybe_push ;;
  no)  info "按 --no-push 配置，跳过推送。需要时可手动：git push $REMOTE $TARGET_BRANCH" ;;
  ask)
    printf "${C_YEL}是否将 $TARGET_BRANCH 推送到远程 $REMOTE？(y/N): ${C_RST}"
    read -r REPLY
    case "$REPLY" in
      [yY]|[yY][eE][sS]) maybe_push ;;
      *) warn "已跳过推送。当前分支 $TARGET_BRANCH 仍为本地状态。" ;;
    esac
    ;;
esac

ok "全部流程结束。"
