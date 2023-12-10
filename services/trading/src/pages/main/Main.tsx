import { Flex, Grid, GridHeader } from '@mint-ui/core';
import { ResponseVolumeRank, VolumeRank } from '@shared/apis/kis';
import { useKisApi } from '@shared/hooks/api-hook';
import { ContentBox, PageContainer, Section } from '@shared/ui/design-system-v1';
import { useEffect, useRef, useState } from 'react';

import { MessageBox } from '../../components/MessageBox';
import { useIsOpenDay } from '../../hooks/is-open-day-hook';

export function Main() {
  // 메시지
  const [ message, setMessage ] = useState({ content: '' });

  // 개장 여부
  const isOpen = useIsOpenDay();

  // 거래량 데이터
  const [ data, setData, refresh ] = useKisApi(VolumeRank, {
    request: {
      params: {
        FID_INPUT_PRICE_1: 2000,
        FID_INPUT_PRICE_2: 40000,
        FID_VOL_CNT: 1000000,
      },
    },
    callback(response) {
      if (autoCount.current < 0) {
        setMessage({ content: response?.msg1 || '' });
      } else {
        autoCount.current += 1;
        setMessage({ content: `자동조회중...${autoCount.current}` });
      }
    },
  });

  // 자동조회
  const autoCount = useRef(-1);
  const [ auto, setAuto ] = useState(false);
  const interval = useRef<number>();
  useEffect(() => {
    if (auto) {
      refresh();
      interval.current = window.setInterval(refresh, 2000);
    }
    return () => {
      window.clearInterval(interval.current);
      interval.current = undefined;
    };
  }, [ auto ]);

  // 버튼 핸들러
  const handleAutoModeClick = () => {
    if (!auto) {
      autoCount.current = 0;
    } else {
      autoCount.current = -1;
    }
    setMessage({ content: '' });
    setAuto(!auto);
  };

  const handleRefreshClick = () => {
    setData([]);
    refresh();
  };

  // 그리드 포맷
  function amountFormat<T>(item:T, header:GridHeader<T>) {
    return String(item[header.targetId]).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
  }
  function percentFormat<T>(item:T, header:GridHeader<T>) {
    return `${String(item[header.targetId])} %`;
  }
  function targetRowClassName(item:ResponseVolumeRank) {
    const per = Number(item.prdy_ctrt);
    const inc = Number(item.vol_inrt);
    return per > 8 && inc > 100 ? 'mint-grid-target-row' : '';
  }
  function amountRedBlue(item:ResponseVolumeRank) {
    const per = Number(item.prdy_ctrt);
    if (per > 0) {
      return 'red';
    }
    if (per < 0) {
      return 'blue';
    }
    return undefined;
  }

  return (
    <PageContainer title='거래량 조회'>
      <ContentBox>
        <Section rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
          <Flex rowDirection flexAlign='center' flexGap='10px'>
            <Flex flexSize='65px' flexAlign='center'>{isOpen === undefined ? '' : `개장일:${isOpen}`}</Flex>
            <MessageBox message={message} clear={!auto} />
          </Flex>
          <Flex rowDirection flexSize='140px' flexAlign='right-center' flexGap='5px'>
            <button onClick={handleAutoModeClick}>{`자동 ${auto ? 'ON' : 'OFF'}`}</button>
            <button disabled={auto} onClick={handleRefreshClick}>전송</button>
          </Flex>
        </Section>
        <Section flexAlign='center'>
          <Flex>
            <Grid
              headers={[
                { label: '순위', targetId: 'data_rank', width: 40, textAlign: 'center' },
                { label: '종목', targetId: 'hts_kor_isnm', minWidth: 60, fontWeight: 700 },
                { label: '현재가', targetId: 'stck_prpr', minWidth: 55, textAlign: 'right', textFormat: amountFormat },
                { label: '등락율', targetId: 'prdy_ctrt', minWidth: 60, textAlign: 'right', textFormat: percentFormat, color: amountRedBlue },
                { label: '거래량', targetId: 'acml_vol', minWidth: 65, textAlign: 'right', textFormat: amountFormat },
                { label: '증가율', targetId: 'vol_inrt', minWidth: 68, textAlign: 'right', textFormat: percentFormat },
              ]}
              data={data || []}
              gridStyle={{ emptyText: 'No data', rowClassName: targetRowClassName }}
              rowHeightExtensible
            />
          </Flex>
        </Section>
      </ContentBox>
    </PageContainer>
  );
}