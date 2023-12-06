import { Flex, Grid } from '@mint-ui/core';
import { ResponseVolumeRank, VolumeRank } from '@shared/apis/kis';
import { useEffect, useRef, useState } from 'react';

export function Main() {
  const [ message, setMessage ] = useState('');
  const [ data, setData ] = useState<ResponseVolumeRank[]>([]);
  const [ auto, setAuto ] = useState(false);

  const handleRequest = () => {
    setData([]);

    setTimeout(async () => {
      const data = await VolumeRank({
        FID_INPUT_PRICE_1: 2000,
        FID_INPUT_PRICE_2: 40000,
        FID_VOL_CNT: 1000000,
      });
      setData(data.output);
      !auto && setMessage(data.msg1);
    });

    !auto && setTimeout(() => setMessage(''), 2500);
  };

  const interval = useRef<number>();
  useEffect(() => {
    if (auto) {
      handleRequest();
      interval.current = window.setInterval(handleRequest, 2000);
    } else {
      window.clearInterval(interval.current);
    }

    return () => {
      window.clearInterval(interval.current);
    };
  }, [ auto ]);

  return (
    <Flex style={{ width: '100vw', height: '100vh' }} flexPadding='10px'>
      <Flex rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
        <div>{message}</div>
        <Flex rowDirection flexSize='140px' flexAlign='right-center' flexGap='5px'>
          <button onClick={() => {
            if (!auto) {
              setMessage('자동조회중...');
            } else {
              setMessage('');
            }
            setAuto(!auto);
          }}
          >{`자동 ${auto ? 'ON' : 'OFF'}`}
          </button>
          <button onClick={handleRequest}>전송</button>
        </Flex>
      </Flex>
      <Flex>
        <Grid
          headers={[
            { label: '순위', targetId: 'data_rank', width: 50, textAlign: 'center' },
            { label: '종목', targetId: 'hts_kor_isnm', width: 100 },
            { label: '현재가', targetId: 'stck_prpr', width: 65, textAlign: 'right' },
            { label: '전일 대비', targetId: 'prdy_ctrt', width: 80, textAlign: 'right' },
            { label: '거래량', targetId: 'acml_vol', width: 80, textAlign: 'right' },
            { label: '거래량증가율', targetId: 'vol_inrt', width: 80, textAlign: 'right' },
          ]}
          data={data}
          gridStyle={{ emptyText: 'No data', minWidth: '360px' }}
          rowHeightExtensible
        />
      </Flex>
    </Flex>
  );
}