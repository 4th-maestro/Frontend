// 파이프라인 ↔ 호스트 앱(대시보드) 메시지. 목록과 필드: twin/README.md "호스트 연동 메시지"
// 부모 창의 메시지만 받고, 보낼 때는 부모 창 origin(document.referrer)을 지정
const parentOrigin = () => document.referrer ? new URL(document.referrer).origin : location.origin;
const fromHost = (e, type) => e.source === window.parent && e.data?.source === 'maestro' && e.data.type === type;
let seq = 0;

// 호스트가 넣는 평면도 이미지: {source:'maestro', type:'plans', files:[File]}
export function onPlans(handler) {
  addEventListener('message', e => { if (fromHost(e, 'plans') && Array.isArray(e.data.files)) handler(e.data.files.filter(f => f instanceof File)); });
}

// 보정 평면도(ImageData 형식 {width, height, data}) 인식 요청 → {detections, key?, error?}
// 호스트가 detect=1로 연 경우에만 호출. 응답이 없으면 6분 뒤 빈 결과로 진행
export async function askDetect(floors, rect, pxPerM, timeoutMs = 6 * 60 * 1000) {
  const c = document.createElement('canvas');
  c.width = rect.width; c.height = rect.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rect.data), rect.width, rect.height), 0, 0);
  const image = await new Promise(r => c.toBlob(r, 'image/png'));
  const id = 'detect-' + (++seq);
  return new Promise(resolve => {
    const done = v => { removeEventListener('message', on); clearTimeout(timer); resolve(v); };
    const on = e => { if (fromHost(e, 'detectResult') && e.data.id === id) done(e.data); };
    const timer = setTimeout(() => done({ detections:[], error:'호스트 응답 시간 초과' }), timeoutMs);
    addEventListener('message', on);
    window.parent.postMessage({ source:'twin', type:'detectRequest', id, floors, image, pxPerM }, parentOrigin());
  });
}
