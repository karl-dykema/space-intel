'use strict';

const CFG_SB_URL  = 'https://wicxziyzayyymsubqpbi.supabase.co';
const CFG_SB_AKEY = 'sb_publishable_60y2euVA3BA6QpRVw_6mjw_F6J1ummh';

const SHARE_MODE = new URLSearchParams(location.search).has('share');

const MAX_LOG = 500;

const LOG_COLORS = {
  ais:   '#00d4ff',
  db:    '#4477ff',
  news:  '#ff8800',
  sys:   '#567fa0',
  event: '#00ff88',
  err:   '#ff4444',
};
