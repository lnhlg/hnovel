import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'

interface CharacterRelationGraphProps {
  projectId: string
  characters: { id: string; name: string; role?: string; description?: string }[]
  relations: { id: string; characterId1: string; characterId2: string; relation: string; description?: string }[]
  width?: number
  height?: number
  onNodeClick?: (characterId: string) => void
  onRelationsGenerated?: () => void
}

interface NodePos {
  x: number
  y: number
}

export default function CharacterRelationGraph({
  projectId,
  characters,
  relations,
  width = 900,
  height = 600,
  onNodeClick,
  onRelationsGenerated
}: CharacterRelationGraphProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null)
  const graphRef = useRef<SVGGElement>(null)
  const nodeElsRef = useRef<Map<string, SVGGElement>>(new Map())
  const linkElsRef = useRef<Map<string, { line: SVGLineElement; label: SVGGElement }>>(new Map())

  const [generating, setGenerating] = useState(false)

  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const panningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  const draggingRef = useRef<string | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const [nodePosMap, setNodePosMap] = useState<Map<string, NodePos>>(new Map())
  const [scale, setScale] = useState(1)

  const centerX = width / 2
  const centerY = height / 2

  const getRoleColor = (role?: string): string => {
    if (!role) return '#5b8def'
    if (role.includes('主角')) return '#4f8cff'
    if (role.includes('反派') || role.includes('敌')) return '#ff6b6b'
    if (role.includes('配角')) return '#51cf66'
    if (role.includes('导师')) return '#cc5de8'
    if (role.includes('恋人') || role.includes('爱人')) return '#ff8787'
    return '#5b8def'
  }

  // 已保存的节点位置（ref 作为可信源，避免闭包旧值问题）
  const savedPosRef = useRef<Record<string, NodePos>>({})
  const [positionsLoaded, setPositionsLoaded] = useState(false)

  // 加载已保存的节点位置
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    savedPosRef.current = {}
    setPositionsLoaded(false)
    window.api.getCharacterPositions(projectId).then((saved: Record<string, NodePos> | undefined) => {
      if (cancelled) return
      if (saved && typeof saved === 'object') {
        savedPosRef.current = saved
      }
      setPositionsLoaded(true)
    })
    return () => { cancelled = true }
  }, [projectId])

  // 计算节点位置：已保存的优先，未保存的用圆形布局
  const computeLayout = useCallback(() => {
    const n = characters.length
    const radius = Math.min(width, height) * 0.35
    const newMap = new Map<string, NodePos>()
    const saved = savedPosRef.current

    characters.forEach((c, i) => {
      const existing = saved[c.id]
      if (existing) {
        newMap.set(c.id, { x: existing.x, y: existing.y })
      } else {
        const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
        newMap.set(c.id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        })
      }
    })

    return newMap
  }, [characters, width, height, centerX, centerY])

  // 当 characters/尺寸变化 或 位置加载完成时，重新计算布局
  useEffect(() => {
    setNodePosMap(computeLayout())
  }, [computeLayout, positionsLoaded])

  const updateNodePos = (id: string, x: number, y: number) => {
    setNodePosMap(prev => {
      const next = new Map(prev)
      next.set(id, { x, y })
      return next
    })
  }

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - offsetRef.current.x) / scaleRef.current,
    y: (sy - offsetRef.current.y) / scaleRef.current
  })

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta))

    const wp = screenToWorld(mx, my)
    offsetRef.current.x = mx - wp.x * newScale
    offsetRef.current.y = my - wp.y * newScale
    scaleRef.current = newScale
    setScale(newScale)

    if (graphRef.current) {
      graphRef.current.setAttribute(
        'transform',
        `translate(${offsetRef.current.x}, ${offsetRef.current.y}) scale(${newScale})`
      )
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height

    if (e.button === 1 || e.shiftKey) {
      panningRef.current = true
      panStartRef.current = { x: mx, y: my, offsetX: offsetRef.current.x, offsetY: offsetRef.current.y }
      e.preventDefault()
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (!svgRef.current) return
    const node = nodePosMap.get(nodeId)
    if (!node) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height
    const wp = screenToWorld(mx, my)
    dragOffsetRef.current = { x: wp.x - node.x, y: wp.y - node.y }
    draggingRef.current = nodeId
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height

    if (panningRef.current) {
      offsetRef.current.x = panStartRef.current.offsetX + (mx - panStartRef.current.x)
      offsetRef.current.y = panStartRef.current.offsetY + (my - panStartRef.current.y)
      if (graphRef.current) {
        graphRef.current.setAttribute(
          'transform',
          `translate(${offsetRef.current.x}, ${offsetRef.current.y}) scale(${scaleRef.current})`
        )
      }
      return
    }

    if (draggingRef.current) {
      const wp = screenToWorld(mx, my)
      const nx = wp.x - dragOffsetRef.current.x
      const ny = wp.y - dragOffsetRef.current.y
      updateNodePos(draggingRef.current, nx, ny)
    }
  }

  const handleMouseUp = () => {
    panningRef.current = false
    if (draggingRef.current) {
      // 拖拽结束，保存所有节点位置
      const positions: Record<string, NodePos> = {}
      nodePosMap.forEach((pos, id) => { positions[id] = pos })
      if (projectId && Object.keys(positions).length > 0) {
        window.api.saveCharacterPositions({ projectId, positions }).catch((err: unknown) => {
          console.error('保存节点位置失败:', err)
        })
      }
    }
    draggingRef.current = null
  }

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    onNodeClick?.(nodeId)
  }

  const handleResetView = () => {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setScale(1)
    if (graphRef.current) {
      graphRef.current.setAttribute('transform', 'translate(0, 0) scale(1)')
    }
  }

  // 重置节点布局：清空保存的位置，重新圆形布局
  const handleResetLayout = async () => {
    savedPosRef.current = {}
    setNodePosMap(computeLayout())
    // 清空已保存的位置
    if (projectId) {
      try {
        await window.api.saveCharacterPositions({ projectId, positions: {} })
      } catch (err: unknown) {
        console.error('清空节点位置失败:', err)
      }
    }
  }

  const handleGenerateRelations = async () => {
    if (generating || !projectId) return
    setGenerating(true)
    try {
      const res = await window.api.generateAsset({
        type: 'relation-batch',
        projectId,
        count: Math.min(6, Math.max(3, characters.length - 1)),
        hint: '包含男女主角关系，主要角色都要有至少一条关系线',
        context: {
          characters: characters.map(c => ({ name: c.name, role: c.role, description: c.description }))
        }
      })
      if (res.error) {
        console.error('生成关系失败:', res.error)
        alert('生成失败：' + res.error)
        return
      }
      const list = Array.isArray(res.data) ? res.data : [res.data]
      const charMap = new Map(characters.map(c => [c.name, c.id]))
      for (const item of list) {
        const c1Id = charMap.get(item.characterId1 || item.character1Name || '')
        const c2Id = charMap.get(item.characterId2 || item.character2Name || '')
        if (c1Id && c2Id && c1Id !== c2Id) {
          const exists = relations.some(r =>
            (r.characterId1 === c1Id && r.characterId2 === c2Id) ||
            (r.characterId1 === c2Id && r.characterId2 === c1Id)
          )
          if (!exists) {
            await window.api.saveCharacterRelation({
              projectId,
              characterId1: c1Id,
              characterId2: c2Id,
              relation: item.relation || '关联',
              description: item.description || ''
            })
          }
        }
      }
      onRelationsGenerated?.()
    } catch (err) {
      console.error(err)
      alert('生成失败：' + (err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const NODE_R = 30

  const validRelations = useMemo(() => {
    const ids = new Set(characters.map(c => c.id))
    return relations.filter(r => ids.has(r.characterId1) && ids.has(r.characterId2))
  }, [relations, characters])

  console.log('[RelationGraph] render:', { chars: characters.length, rels: relations.length, valid: validRelations.length, posMap: nodePosMap.size })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-hover)'
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>角色关系图</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
          {characters.length} 个角色 · {validRelations.length} 条关系
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleGenerateRelations}
          disabled={generating || characters.length === 0}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--color-accent)',
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            cursor: generating || characters.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 12,
            opacity: generating || characters.length === 0 ? 0.6 : 1
          }}
        >
          {generating ? '生成中...' : (validRelations.length === 0 ? 'AI 生成关系' : '重新生成关系')}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {characters.length === 0 ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--color-text-dim)',
            fontSize: 14
          }}>
            <p>暂无角色数据</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>请先创建角色</p>
          </div>
        ) : validRelations.length === 0 && !generating ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--color-text-dim)',
            fontSize: 14,
            zIndex: 5
          }}>
            <p>暂无角色关系</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>点击右上角「AI 生成关系」自动生成</p>
          </div>
        ) : null}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: panningRef.current ? 'grabbing' : 'default', userSelect: 'none' }}
        >
        <g ref={graphRef}>
          {validRelations.map(link => {
            const s = nodePosMap.get(link.characterId1)
            const t = nodePosMap.get(link.characterId2)
            if (!s || !t) return null
            const dx = t.x - s.x
            const dy = t.y - s.y
            const d = Math.sqrt(dx * dx + dy * dy) || 1
            const sx = s.x + (dx / d) * NODE_R
            const sy = s.y + (dy / d) * NODE_R
            const tx = t.x - (dx / d) * NODE_R
            const ty = t.y - (dy / d) * NODE_R
            const mx = (sx + tx) / 2
            const my = (sy + ty) / 2
            return (
              <g key={link.id}>
                <line
                  ref={el => {
                    if (!el) return
                    const m = linkElsRef.current.get(link.id)
                    if (m) m.line = el
                    else linkElsRef.current.set(link.id, { line: el, label: null as any })
                  }}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke="var(--color-border)"
                  strokeWidth="2"
                  strokeOpacity="0.7"
                />
                <g
                  ref={el => {
                    if (!el) return
                    const m = linkElsRef.current.get(link.id)
                    if (m) m.label = el
                    else linkElsRef.current.set(link.id, { line: null as any, label: el })
                  }}
                  transform={`translate(${mx}, ${my})`}
                >
                  <rect
                    x={-link.relation.length * 4.5 - 10}
                    y={-9}
                    width={link.relation.length * 9 + 20}
                    height="18"
                    rx="6"
                    fill="var(--color-surface)"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="3"
                    fontSize="11"
                    fill="var(--color-text-secondary)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {link.relation}
                  </text>
                </g>
              </g>
            )
          })}

          {characters.map(char => {
            const pos = nodePosMap.get(char.id)
            if (!pos) return null
            const color = getRoleColor(char.role)
            return (
              <g
                key={char.id}
                ref={el => { if (el) nodeElsRef.current.set(char.id, el) }}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleNodeMouseDown(e, char.id)}
                onClick={(e) => handleNodeClick(e, char.id)}
              >
                <circle r="32" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="2" />
                <circle r="26" fill="var(--color-surface)" stroke={color} strokeWidth="1.5" />
                <text
                  textAnchor="middle"
                  y="4"
                  fontSize="13"
                  fontWeight="600"
                  fill="var(--color-text)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {char.name.length > 4 ? char.name.slice(0, 4) : char.name}
                </text>
                {char.role && (
                  <text
                    textAnchor="middle"
                    y="42"
                    fontSize="10"
                    fill="var(--color-text-dim)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {char.role}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 6,
        backgroundColor: 'var(--color-surface-hover)',
        border: '1px solid var(--color-border)',
        fontSize: 11,
        color: 'var(--color-text-secondary)',
        zIndex: 10
      }}>
        <button
          onClick={handleResetView}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          重置视图
        </button>
        <button
          onClick={handleResetLayout}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          重置布局
        </button>
        <span style={{ alignSelf: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <span style={{ alignSelf: 'center', color: 'var(--color-text-dim)' }}>
          滚轮缩放 · Shift+拖拽平移 · 拖拽节点自动保存
        </span>
      </div>
      </div>
    </div>
  )
}
