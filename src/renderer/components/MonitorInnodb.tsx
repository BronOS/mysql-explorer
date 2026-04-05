import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useIpc } from '../hooks/use-ipc';
import { useTheme } from '../hooks/use-theme';

interface Props {
  connectionId: string;
  refreshTrigger: number;
}

export default function MonitorInnodb({ connectionId, refreshTrigger }: Props) {
  const ipc = useIpc();
  const { cmExtension } = useTheme();
  const [status, setStatus] = useState('');

  useEffect(() => {
    ipc.monitorInnodbStatus(connectionId).then((data: string) => {
      setStatus(data || '');
    }).catch(() => setStatus(''));
  }, [connectionId, refreshTrigger]);

  return (
    <CodeMirror
      value={status}
      readOnly
      theme={cmExtension}
      height="100%"
      basicSetup={{ lineNumbers: true }}
    />
  );
}
