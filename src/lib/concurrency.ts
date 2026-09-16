/**
 * 并发控制工具
 *
 * 背景（2026-09-16 评审）：多处「对 N 个同质对象各发一次请求」写成 `for + await` 串行，
 * 于是总耗时 = N × 单次 RTT。典型：`videoService.searchVideoSeasonsFromSingleSource` 对
 * 每个「第X季」条目串行解析（N 次详情请求）；`SourceChecker` 串行探测全部源。
 *
 * 为什么不用 `Promise.all(map)` 直接全并发：CMS 源多是自建小站，瞬时开 N 条连接会被
 * 限流甚至封 IP，且浏览器同域并发上限（6）之下多余请求也只是排队。故需要「受限并发」。
 */

/**
 * 以固定并发上限映射数组，**返回结果顺序与输入顺序一致**。
 *
 * 语义要点：
 * - 顺序保证：`results[i]` 恒对应 `items[i]`，与完成先后无关（调用方常依赖顺序，
 *   例如按搜索结果顺序写入 `Map` 决定「第一季」是谁）。
 * - 快速失败：任一 mapper 抛错 → 整个 Promise reject（与 `Promise.all` 一致）；
 *   此时其它在飞任务不会被主动打断，调用方应配合 `AbortSignal` 取消底层请求。
 * - `limit` 会被规整到 `[1, items.length]`，空数组直接返回 `[]`。
 *
 * @param items 待处理数组（只读）
 * @param limit 并发上限（<=0 / NaN 视为 1）
 * @param mapper 处理函数，接收元素与下标
 *
 * @example
 * // 5 个季，最多同时解析 3 个；结果仍按季号顺序返回
 * const resolved = await mapWithConcurrency(seasons, 3, (s) => resolveSeason(s));
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const total = items.length;
  if (total === 0) return [];

  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.floor(limit) : 1, total));
  const results = new Array<R>(total);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= total) return;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
}

export default mapWithConcurrency;
