/** Line-based diff (baseline → current). Same roles as `diffLines` from the `diff` package. */
export type DiffLinePart = {
  value: string
  added?: boolean
  removed?: boolean
}

export function diffLines(baselineText: string, currentText: string): DiffLinePart[] {
  const a = baselineText.split(/\r?\n/)
  const b = currentText.split(/\r?\n/)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const stack: DiffLinePart[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ value: a[i - 1] + '\n' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ value: b[j - 1] + '\n', added: true })
      j--
    } else if (i > 0) {
      stack.push({ value: a[i - 1] + '\n', removed: true })
      i--
    }
  }

  return stack.reverse()
}
