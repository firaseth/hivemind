import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = {};

const initialNodes = [
  { 
    id: 'goal', 
    type: 'input', 
    data: { label: '🎯 User Goal' }, 
    position: { x: 250, y: 0 },
    style: { background: '#f8f9fa', border: '2px solid #1a1a18', borderRadius: '8px', fontWeight: 'bold' }
  },
  { 
    id: 'planner', 
    data: { label: '📋 Planner' }, 
    position: { x: 250, y: 100 },
    style: { background: '#E6F1FB', border: '1px solid #185FA5', borderRadius: '8px' }
  },
  { 
    id: 'researcher', 
    data: { label: '🔍 Researcher' }, 
    position: { x: 100, y: 200 },
    style: { background: '#E1F5EE', border: '1px solid #0F6E56', borderRadius: '8px' }
  },
  { 
    id: 'creator', 
    data: { label: '🎨 Creator' }, 
    position: { x: 400, y: 200 },
    style: { background: '#FAECE7', border: '1px solid #993C1D', borderRadius: '8px' }
  },
  { 
    id: 'executor', 
    data: { label: '⚡ Executor' }, 
    position: { x: 250, y: 300 },
    style: { background: '#EAF3DE', border: '1px solid #3B6D11', borderRadius: '8px' }
  },
  { 
    id: 'critic', 
    data: { label: '⚖️ Critic' }, 
    position: { x: 250, y: 400 },
    style: { background: '#FAEEDA', border: '1px solid #BA7517', borderRadius: '8px' }
  },
  { 
    id: 'consensus', 
    type: 'output', 
    data: { label: '✅ Consensus' }, 
    position: { x: 250, y: 500 },
    style: { background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }
  },
];

const initialEdges = [
  { id: 'e-goal-planner', source: 'goal', target: 'planner', animated: true },
  { id: 'e-planner-researcher', source: 'planner', target: 'researcher' },
  { id: 'e-planner-creator', source: 'planner', target: 'creator' },
  { id: 'e-researcher-executor', source: 'researcher', target: 'executor' },
  { id: 'e-creator-executor', source: 'creator', target: 'executor' },
  { id: 'e-executor-critic', source: 'executor', target: 'critic' },
  { id: 'e-critic-consensus', source: 'critic', target: 'consensus', markerEnd: { type: MarkerType.ArrowClosed } },
];

export const SwarmGraph: React.FC<{ activeAgent?: string }> = ({ activeAgent }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (activeAgent) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === activeAgent) {
            return {
              ...node,
              style: { ...node.style, boxShadow: '0 0 15px rgba(15, 110, 86, 0.6)', border: '2px solid #0F6E56', transform: 'scale(1.05)' },
            };
          }
          return {
            ...node,
            style: { ...node.style, boxShadow: 'none', transform: 'scale(1)' },
          };
        })
      );
    }
  }, [activeAgent, setNodes]);

  return (
    <div style={{ width: '100%', height: '400px', background: '#fcfcfb', borderRadius: '12px', border: '1px solid #ebebe6' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background color="#aaa" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default SwarmGraph;
