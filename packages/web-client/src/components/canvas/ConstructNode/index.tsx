import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useConnection, useNodeId } from '@xyflow/react';
import { getPortsForSchema } from '@carta/domain';
import type { ConstructNodeData } from '@carta/domain';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLodBand } from '../lod/useLodBand';
import { stripHandlePrefix } from '../../../utils/handlePrefix';
import { ConstructNodePill } from './ConstructNodePill';
import { ConstructNodeCard } from './ConstructNodeCard';
import { ConstructNodeDefault } from './ConstructNodeDefault';

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
    data,
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
  if (schema.renderStyle === 'card') {
    return <ConstructNodeCard {...variantProps} />;
  }
  return <ConstructNodeDefault {...variantProps} />;
});

export default ConstructNode;
