import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useConnection, useNodeId } from '@xyflow/react';
import { getPortsForSchema } from '@carta/domain';
import type { ConstructNodeData, ConstructValues } from '@carta/domain';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLodBand } from '../lod/useLodBand';
import { stripHandlePrefix } from '../../../utils/handlePrefix';
import { ConstructNodePill } from './ConstructNodePill';
import { ConstructNodeSimple } from './ConstructNodeSimple';
import { ConstructNodeDefault } from './ConstructNodeDefault';
import type { NodeActions } from '../nodeActions';

interface ConstructNodeComponentProps {
  data: ConstructNodeData;
  selected?: boolean;
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
      onSetViewLevel: (level: 'summary' | 'details') => actions.onSetViewLevel(nodeId, level),
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
  if (lod.band === 'pill') {
    return <ConstructNodePill {...variantProps} />;
  }
  if (schema.renderStyle === 'simple') {
    return <ConstructNodeSimple {...variantProps} />;
  }
  return <ConstructNodeDefault {...variantProps} />;
});

export default ConstructNode;
