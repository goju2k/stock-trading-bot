import { Grid, GridHeader } from '@mint-ui/core';
import { ResponseVolumeRank } from '@shared/apis/kis';
import { useStateRef } from '@shared/hooks/util-hook';
import { OrderStocks, OrderTrading } from '@shared/states/global';
import { useRecoilValue } from 'recoil';

import { useIsTargetRow } from '../hooks/is-target-row';

interface MainGridProps {
  data?:ResponseVolumeRank[];
}

// 금액 regexp
const AMOUNT_REG_EXP = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;

export function MainGrid({ data }:MainGridProps) {
  
  // 매수 대상 여부
  const isTargetRow = useIsTargetRow();

  // 주문 내역
  const orderStocks = useRecoilValue(OrderStocks);
  const orderStocksRef = useStateRef(orderStocks);

  const orderTrading = useRecoilValue(OrderTrading);
  const orderTradingRef = useStateRef(orderTrading);
  
  // 그리드 포맷
  function amountFormat<T>(item:T, header:GridHeader<T>) {
    return String(item[header.targetId]).replace(AMOUNT_REG_EXP, ',');
  }
  function percentFixedFormat<T>(item:T, header:GridHeader<T>) {
    const val = Number(item[header.targetId]);
    return `${(val > 9999 ? '9999' : val.toFixed(0)).replace(AMOUNT_REG_EXP, ',')} %`;
  }
  function percentFormat<T>(item:T, header:GridHeader<T>) {
    return `${String(item[header.targetId])} %`;
  }
  function targetRowClassName(item:ResponseVolumeRank) {
    
    if (orderTradingRef.current.filter((trad) => trad.code === item.mksc_shrn_iscd 
    && trad.state !== 'done' 
    && trad.state !== 'error').length > 0) {
      return 'mint-grid-processing-row';
    }
    if (orderStocksRef.current.includes(item.mksc_shrn_iscd)) {
      return 'mint-grid-ordered-row';
    }
    return isTargetRow(item) ? 'mint-grid-target-row' : '';
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
    <Grid
      headers={[
        { label: '순위', targetId: 'data_rank', width: 40, textAlign: 'center' },
        { label: '종목', targetId: 'hts_kor_isnm', minWidth: 60, fontWeight: 700 },
        { label: '현재가', targetId: 'stck_prpr', minWidth: 50, textAlign: 'right', textFormat: amountFormat },
        { label: '등락율', targetId: 'prdy_ctrt', minWidth: 55, textAlign: 'right', textFormat: percentFormat, color: amountRedBlue },
        { label: '거래량', targetId: 'acml_vol', minWidth: 65, textAlign: 'right', textFormat: amountFormat },
        { label: '증가율', targetId: 'vol_inrt', minWidth: 55, textAlign: 'right', textFormat: percentFixedFormat },
      ]}
      data={data || []}
      gridStyle={{ emptyText: 'No data', rowClassName: targetRowClassName }}
      rowHeightExtensible
    />
  );
}