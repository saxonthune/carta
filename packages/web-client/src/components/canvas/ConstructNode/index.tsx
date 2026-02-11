import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useConnection, useNodeId } from '@xyflow/react';
import { getPortsForSchema } from '@carta/domain';
import type { ConstructNodeData, ConstructValues } from '@carta/domain';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLodBand } from '../lod/useLodBand';
import { stripHandlePrefix } from '../../../utils/handlePrefix';
import { ConstructNodeMarker } from './ConstructNodeMarker';
import { ConstructNodeSimple } from './ConstructNodeSimple';
import { ConstructNodeDefault } from './ConstructNodeDefault';
import { ConstructNodeCircle } from './ConstructNodeCircle';
import { ConstructNodeDiamond } from './ConstructNodeDiamond';
import { ConstructNodeDocument } from './ConstructNodeDocument';
import type { NodeActions } from '../nodeActions';

interface ConstructNodeComponentProps {
  data: ConstructNodeData;
  selected?: boolean;
}

function SequenceBadge({ ordinal }: { ordinal: number }) {
  return (
    <div
      className="absolute -top-2 -left-2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold leading-none pointer-events-none"
      style={{
        backgroundColor: 'var(--color-surface-alt)',
        color: 'var(--color-content)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        border: '1px solid var(--color-border)',
      }}
    >
      {ordinal}
    </div>
  );
}

const ConstructNode = memo(function ConstructNode({ data, selected = false }: ConstructNodeComponentProps) {
  const lod = useLodBand();
  const { getSchema } = useSchemas();
  const schema = getSchema(data.constructType);
  const nodeId = useNodeId();
  const connection = useConnection();

  // Connection state
  const isConnectionTarget = connection.inProgress && connection.toNode?.id === nodeId;
  const isDragActive = connection.inProgress;

  // Look up source port type from the connection's fromHandle
  let sourcePortType: string | undefined;
  if (connection.inProgress && connection.fromHandle?.id) {
    const cleanHandleId = stripHandlePrefix(connection.fromHandle.id);
    const sourceData = connection.fromNode?.data as ConstructNodeData | undefined;
    if (sourceData) {
      const sourceSchema = getSchema(sourceData.constructType);
      if (sourceSchema) {
        const sourcePorts = getPortsForSchema(sourceSchema.ports);
        const sourcePort = sourcePorts.find(p => p.id === cleanHandleId);
        if (sourcePort) {
          sourcePortType = sourcePort.portType;
        }
      }
    }
  }

  // LOD transition crossfade
  const prevBandRef = useRef(lod.band);
  const [lodTransitioning, setLodTransitioning] = useState(false);

  useEffect(() => {
    if (prevBandRef.current !== lod.band) {
      prevBandRef.current = lod.band;
      setLodTransitioning(true);
      requestAnimationFrame(() => setLodTransitioning(false));
    }
  }, [lod.band]);

  const lodTransitionStyle: React.CSSProperties = {
    opacity: lodTransitioning ? 0 : 1,
    transition: 'opacity 120ms ease',
  };

  // Bind nodeActions to this node's ID so variants use familiar data.onX() API
  const actions = data.nodeActions as NodeActions | undefined;
  const boundData = useMemo(() => {
    if (!actions || !nodeId) return data;
    return {
      ...data,
      onValuesChange: (values: ConstructValues) => actions.onValuesChange(nodeId, values),
      onSetDetailMode: (level: 'summary' | 'details') => actions.onSetDetailMode(nodeId, level),
      onToggleDetailsPin: () => actions.onToggleDetailsPin(nodeId),
      onOpenFullView: () => actions.onOpenFullView(nodeId),
      onInstanceColorChange: (color: string | null) => actions.onInstanceColorChange(nodeId, color),
    };
  }, [data, actions, nodeId]);

  // Error state - unknown schema
  if (!schema) {
    return (
      <div className="bg-danger-muted border-2 border-danger rounded-lg min-w-[180px] p-2 text-node-lg text-content">
        <Handle type="target" position={Position.Left} id="flow-in" className="port-handle" />
        <div>Unknown construct type: {data.constructType}</div>
        <Handle type="source" position={Position.Right} id="flow-out" className="port-handle" />
      </div>
    );
  }

  const ports = getPortsForSchema(schema.ports);

  const variantProps = {
    id: nodeId!,
    data: boundData,
    selected,
    schema,
    ports,
    isConnectionTarget,
    isDragActive,
    sourcePortType,
    lodTransitionStyle,
  };

  // Dispatch to variant based on LOD band and render style
  const dimmed = (data as Record<string, unknown>).dimmed as boolean | undefined;
  const sequenceBadge = (data as Record<string, unknown>).sequenceBadge as number | undefined;

  let variant: React.ReactNode;
  if (lod.band === 'marker') {
    variant = <ConstructNodeMarker {...variantProps} />;
  } else if (schema.nodeShape === 'simple') {
    variant = <ConstructNodeSimple {...variantProps} />;
  } else if (schema.nodeShape === 'circle') {
    variant = <ConstructNodeCircle {...variantProps} />;
  } else if (schema.nodeShape === 'diamond') {
    variant = <ConstructNodeDiamond {...variantProps} />;
  } else if (schema.nodeShape === 'document') {
    variant = <ConstructNodeDocument {...variantProps} />;
  } else {
    variant = <ConstructNodeDefault {...variantProps} />;
  }

  const content = (
    <div className="relative w-full h-full">
      {sequenceBadge != null && lod.band !== 'marker' && (
        <SequenceBadge ordinal={sequenceBadge} />
      )}
      {variant}
    </div>
  );

  if (dimmed) {
    return (
      <div style={{ opacity: 0.2, pointerEvents: 'none', transition: 'opacity 150ms ease' }}>
        {content}
      </div>
    );
  }

  return content;
});

export default ConstructNode;
