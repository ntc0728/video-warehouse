import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';
import { checkAllVideoSources, getVideoSources } from '@/services/videoService';
import type { SourceCheckResult } from '@/services/videoService';
import type { VideoSourceConfig } from '@/types/source';
import { BackToTopButton } from '@/components/common';
import './SourceChecker.css';

type SourceItem = SourceCheckResult & { config?: VideoSourceConfig };

type CheckState = 'idle' | 'checking' | 'done';

export default function SourceCheckerPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [state, setState] = useState<CheckState>('idle');
  const [progress, setProgress] = useState(0);
  const [totalSources, setTotalSources] = useState(0);

  const handleCheck = useCallback(async () => {
    setState('checking');
    setProgress(0);

    const configs = await getVideoSources();
    setTotalSources(configs.length);

    const result = await checkAllVideoSources(5, 10000);

    const items: SourceItem[] = result.results.map((r) => ({
      ...r,
      config: configs[r.index],
    }));

    setSources(items);
    setProgress(result.results.length);
    setState('done');
  }, []);

  const availableCount = sources.filter((s) => s.available).length;
  const unavailableCount = sources.filter((s) => !s.available).length;

  return (
    <div className="source-checker-page">
      <div className="source-checker-header">
        <h1>视频源检测</h1>
        <p>检测所有配置的视频数据源，查看哪些源可用</p>
      </div>

      <div className="source-checker-stats">
        <div className="stat-card total">
          <div className="stat-value">{sources.length || totalSources || '-'}</div>
          <div className="stat-label">总源数</div>
        </div>
        <div className="stat-card available">
          <div className="stat-value">{state === 'done' ? availableCount : '-'}</div>
          <div className="stat-label">可用</div>
        </div>
        <div className="stat-card unavailable">
          <div className="stat-value">{state === 'done' ? unavailableCount : '-'}</div>
          <div className="stat-label">不可用</div>
        </div>
      </div>

      <div className="source-checker-actions">
        <Button
          color="primary"
          disabled={state === 'checking'}
          onClick={handleCheck}
        >
          {state === 'checking' ? '检测中...' : state === 'done' ? '重新检测' : '开始检测'}
        </Button>
        {state === 'checking' && (
          <span className="hint">
            正在检测第 {progress} / {totalSources} 个源...
          </span>
        )}
        {state === 'done' && (
          <span className="hint">
            检测完成，共 {availableCount} 个源可用
          </span>
        )}
      </div>

      {sources.length > 0 && (
        <table className="source-table">
          <thead>
            <tr>
              <th>#</th>
              <th>源名称</th>
              <th>状态</th>
              <th>视频数</th>
              <th>响应时间</th>
              <th>API 地址</th>
              <th>错误信息</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.index}>
                <td>
                  <span className="source-index">{source.index}</span>
                </td>
                <td>
                  <span className="source-name">{source.name}</span>
                </td>
                <td>
                  {source.available ? (
                    <>
                      <span className="source-status-dot available" />
                      <span style={{ color: 'var(--color-success, #22c55e)' }}>可用</span>
                    </>
                  ) : (
                    <>
                      <span className="source-status-dot unavailable" />
                      <span style={{ color: 'var(--color-danger, #ef4444)' }}>不可用</span>
                    </>
                  )}
                </td>
                <td>
                  {source.videoCount !== undefined ? (
                    <span className="source-count">{source.videoCount}</span>
                  ) : (
                    <span className="source-elapsed">-</span>
                  )}
                </td>
                <td>
                  <span className="source-elapsed">{source.elapsed}ms</span>
                </td>
                <td>
                  <span className="source-api" title={source.config?.api}>
                    {source.config?.api || '-'}
                  </span>
                </td>
                <td>
                  {source.error && (
                    <span className="source-error" title={source.error}>
                      {source.error}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <BackToTopButton />
    </div>
  );
}