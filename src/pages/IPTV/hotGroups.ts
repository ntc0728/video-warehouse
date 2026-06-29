const HOT_GROUP_KEYWORDS: Array<string[]> = [
  ['央', 'CCTV', 'cctv'],
  ['卫视'],
  ['体育'],
  ['影视', '电影'],
  ['少儿', '儿童', '动画'],
  ['纪录'],
  ['新闻'],
  ['港澳台', '港台', '香港', '台湾'],
]

const HOT_GROUP_SLOT_COUNT = 2

export function resolveHotGroups(
  groups: Array<{ name: string; count: number }>,
): string[] {
  if (groups.length === 0) return []

  const keywordMatched = new Set<string>()
  const hotGroups: Array<{ name: string; count: number }> = []

  for (const keywords of HOT_GROUP_KEYWORDS) {
    if (hotGroups.length >= HOT_GROUP_SLOT_COUNT) break
    const matched = groups.find((g) =>
      keywords.some((kw) => g.name.toLowerCase().includes(kw.toLowerCase())),
    )
    if (matched && !keywordMatched.has(matched.name)) {
      keywordMatched.add(matched.name)
      hotGroups.push(matched)
    }
  }

  if (hotGroups.length < HOT_GROUP_SLOT_COUNT) {
    const remaining = groups
      .filter((g) => !keywordMatched.has(g.name))
      .sort((a, b) => b.count - a.count)
    for (const group of remaining) {
      if (hotGroups.length >= HOT_GROUP_SLOT_COUNT) break
      hotGroups.push(group)
    }
  }

  return hotGroups.map((g) => g.name)
}
