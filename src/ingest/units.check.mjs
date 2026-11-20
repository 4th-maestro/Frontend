// 실내기 매핑 계산 자가 점검: node src/ingest/units.check.mjs (Node 23.6 이상, TypeScript 형식 제거 실행)
import assert from 'node:assert/strict'
import { applyDetections, assignRoom, detectionsToUnits, fromPlan, similarity, toPlan } from './units.ts'

const near = (a, b, eps = 1e-6) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) < eps), `${a} ≠ ${b}`)

// 1. 기준점 2쌍: 90도 회전, 축척 0.05, 이동 (10, 2) → 두 점과 임의의 점이 모두 맞아야 함
const truth = ([u, v]) => [10 - v * .05, 2 + u * .05]
const m = similarity([[100, 40], [300, 260]], [truth([100, 40]), truth([300, 260])])
near(toPlan(m, [520, 77]), truth([520, 77]))
near(fromPlan(m, truth([520, 77])), [520, 77])
assert.equal(similarity([[1, 1], [1, 1]], [[0, 0], [1, 0]]), null)

// 2. 호실 배정: 포함하는 실, 실 밖이면 가장 가까운 실
const rooms = [
  { id: 'A', name: 'A', type: 'room', polygon: [[0, 0], [5, 0], [5, 4], [0, 4]] },
  { id: 'B', name: 'B', type: 'room', polygon: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  { id: 'C', name: '복도', type: 'corridor', polygon: [[0, 4], [10, 4], [10, 6], [0, 6]] },
]
assert.deepEqual([assignRoom([2, 2], rooms).room.id, assignRoom([2, 2], rooms).inside], ['A', true])
assert.deepEqual([assignRoom([3, 5], rooms).room.id, assignRoom([3, 5], rooms).inside], ['C', true])
assert.deepEqual([assignRoom([11, 1], rooms).room.id, assignRoom([11, 1], rooms).inside], ['B', false])

// 3. 인식 결과 → 실내기: 상자 중심 좌표, 크기(m), review 조건(신뢰도 0.5 미만, unknown, 실 밖)
const floor = { id: '2F', rooms, detections: [
  { cls: 'cassette_4way', conf: .9, box: [40, 40, 60, 60] },
  { cls: 'wall_mounted', conf: .3, box: [140, 20, 160, 30] },
  { cls: 'mystery', conf: .8, box: [140, 60, 160, 80] },
  { cls: 'cassette_1way', conf: .8, box: [215, 20, 225, 30] },
] }
const scale = [.05, 0, 0, 0, .05, 0]
const units = detectionsToUnits(floor, scale)
assert.deepEqual(units.map(u => [u.room, u.pos, u.review]), [['A', [2.5, 2.5], false], ['B', [7.5, 1.25], true], ['B', [7.5, 3.5], true], ['B', [11, 1.25], true]])
assert.deepEqual(units[0].size, [1, 1])
assert.deepEqual([units[0].type, units[0].model, units[0].source], ['천장형 4방향 카세트', 'ARNU12GTRB4', 'yolo'])
assert.equal(units[2].cls, 'unknown')

// 4. 초안 정리: 맞춘 층만 변환, 면적 추정 실내기 제외, 미맞춤 층은 detections 유지
const plan = { schema: 'twin.building/v1', building: { name: 't', size: { w: 10, d: 6 } },
  floors: [{ ...floor, background: { px: [200, 120], toPlan: scale } }, { id: '3F', rooms: [], detections: floor.detections, background: { px: [200, 120], toPlan: null } }],
  idus: [{ id: 'old', room: 'A', pos: [1, 1], source: 'estimate' }, { id: 'kept', room: 'A', pos: [1, 1], source: 'plan' }, { id: 'ifc', room: 'B', pos: [6, 1], cls: 'ceiling_duct', model: 'X-1' }] }
const out = applyDetections(plan)
assert.deepEqual(out.idus.map(u => u.id), ['kept', 'ifc', 'IDU-2F-yolo-1', 'IDU-2F-yolo-2', 'IDU-2F-yolo-3', 'IDU-2F-yolo-4'])
assert.deepEqual([out.floors[0].detections.length, out.floors[1].detections.length], [0, 4])
assert.deepEqual([out.idus[1].type, out.idus[1].model], ['천장 매립 덕트형', 'X-1'])
console.log('units.check: 통과')
