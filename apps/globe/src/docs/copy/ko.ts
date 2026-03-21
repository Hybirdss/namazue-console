import type { DocsCopy } from '../content';

const ko: DocsCopy = {
  meta: {
    title: 'Namazue 문서',
    description: 'Namazue 지진 인텔리전스 콘솔을 위한 제품 문서.',
  },
  hero: {
    kicker: '제품 문서',
    title: '행동하기 전에 먼저 콘솔을 읽는 법부터 이해한다.',
    summary:
      'Namazue는 지진 활동을 지도 문맥, 노출 자산, 판단 중심 패널로 엮어 읽을 수 있는 운영 상황으로 정리한다.',
  },
  sections: {
    'what-this-product-does': {
      title: '이 제품이 하는 일',
      body:
        '지진 활동을 읽고 운영 상황으로 정리하며, 지도와 패널 해석이 같은 문맥 안에서 이어지도록 만든다.',
    },
    'core-workflow': {
      title: '핵심 흐름',
      body:
        '이벤트나 시나리오가 활성화되면 콘솔이 예상 결과를 해석하고, 사용자는 메인 화면을 벗어나지 않은 채 리플레이, 장소, 자산 문맥을 더 깊게 본다.',
    },
    capabilities: {
      title: '주요 기능',
      body:
        '기능은 메뉴 이름이 아니라 사용 목적 기준으로 정리되어, 제품이 단순 기능 모음이 아니라 흐름처럼 읽히게 한다.',
    },
    'console-anatomy': {
      title: '콘솔 구성',
      body:
        '각 패널이 하나의 역할만 맡고, 지도와 체크 항목과 설명이 같은 운영 프레임 안에 있도록 유지해 메인 화면을 읽기 쉽게 만든다.',
    },
    'how-to-use-it': {
      title: '사용 방법',
      body:
        '현재 이벤트 상태를 먼저 보고, 노출 자산을 확인하고, 즉시 확인할 항목을 읽은 다음, 필요할 때 리플레이나 시나리오 시프트로 비교한다.',
    },
    'trust-boundaries': {
      title: '신뢰 경계',
      body:
        'Namazue는 의사결정 보조 화면이다. 운영 해석을 제공하지만, 현장 확인이나 공식 경보를 대신하는 것으로 취급하면 안 된다.',
    },
    'go-deeper': {
      title: '더 깊게 보기',
      body:
        '실시간 읽기에는 라이브 콘솔을, 내부 검토에는 랩 화면을, 구현과 근거 확인에는 기술 문서를 사용한다.',
    },
  },
  capabilities: {
    'see-the-event': {
      title: '이벤트를 본다',
      summary: '원시 피드 항목이 아니라 운영 상황으로 현재 이벤트를 읽는다.',
      whyItMatters: '현재 이벤트 상태와 주변 문맥이 먼저 보여야 무엇에 주의를 둘지 판단할 수 있다.',
      nextAction: '현재 이벤트 상태를 열고 지도에서 1차 문맥을 확인한다.',
    },
    'read-operational-impact': {
      title: '운영 영향을 읽는다',
      summary: '현재 이벤트 아래에서 자산과 확인 항목이 어떻게 재정렬되는지 파악한다.',
      whyItMatters: '운영 가치의 핵심은 규모 수치 자체보다 결과의 우선순위화에 있다.',
      nextAction: '노출 자산과 현재 액션 스택을 함께 훑는다.',
    },
    'explore-replay-and-scenario-shift': {
      title: '리플레이와 시나리오 시프트를 탐색한다',
      summary: '시간 변화와 가정 변화에 따라 콘솔이 어떻게 달라지는지 비교한다.',
      whyItMatters: '비교가 필요한 순간에는 리플레이와 시나리오 시프트가 판단 근거를 더 읽기 쉽게 만든다.',
      nextAction: '리플레이 레일이나 시나리오 제어로 결과 변화 방향을 비교한다.',
    },
    'inspect-place-and-asset-context': {
      title: '장소와 자산 문맥을 본다',
      summary: '전체 사고 그림을 유지한 채 특정 장소나 자산 문맥으로 들어간다.',
      whyItMatters: '사용자는 전체 사고 그림을 잃지 않고도 특정 장소나 자산 질문에 답해야 하는 경우가 많다.',
      nextAction: '장소 또는 자산을 선택하고 연결된 로컬 문맥을 읽는다.',
    },
    'understand-why-the-console-says-this': {
      title: '왜 이렇게 말하는지 이해한다',
      summary: '대화형 인터페이스로 바꾸지 않고, 짧은 설명으로 콘솔의 판단 이유를 읽는다.',
      whyItMatters: '표면이 평이한 운영 언어로 이유를 설명할수록 신뢰가 올라간다.',
      nextAction: '현재 상태 주변의 설명 문장과 관련 문맥을 확인한다.',
    },
  },
  anatomy: {
    'event-snapshot': {
      title: 'Event Snapshot',
      body: '무엇이 달라졌는지를 운영 언어로 먼저 선언해 사용자가 바로 방향을 잡게 한다.',
    },
    'asset-exposure': {
      title: 'Asset Exposure',
      body: '영향받는 자산을 결과 중심으로 정렬해 우선순위를 사용자가 추측하지 않게 한다.',
    },
    'check-these-now': {
      title: 'Check These Now',
      body: '현재 상태를 지금 먼저 읽어야 할 짧은 확인 목록으로 바꾼다.',
    },
    'replay-rail': {
      title: 'Replay Rail',
      body: '시간에 따라 콘솔 상태가 어떻게 변하는지 보여줘 흐름이 끊기지 않게 한다.',
    },
  },
};

export default ko;
