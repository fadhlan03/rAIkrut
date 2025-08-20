'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

import { DepartmentNode } from './department-node';
import { createDepartment, updateDepartment, deleteDepartment, getDepartments } from '@/app/actions';
import { Department } from '@/app/actions';
import { JobVacancy } from '@/types/database';
import { toast } from 'sonner';

const nodeTypes = {
  department: DepartmentNode,
};

interface OrganizationChartProps {
  initialDepartments: Department[];
  availableJobs: JobVacancy[];
}

interface DepartmentNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  assignedJobs: string[];
  onUpdate: (id: string, data: Partial<DepartmentNodeData>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddParent: (childId: string) => void;
  availableJobs: JobVacancy[];
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 300;
const nodeHeight = 200;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

function OrganizationChartInner({ initialDepartments, availableJobs }: OrganizationChartProps) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isCreatingChild, setIsCreatingChild] = useState<string | null>(null);
  const [isCreatingParent, setIsCreatingParent] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  const handleNodeUpdate = useCallback(async (id: string, data: Partial<DepartmentNodeData>) => {
    try {
      await updateDepartment({
        id,
        name: data.name || '',
        description: data.description,
      });
      
      setDepartments(prev => prev.map(dept => 
        dept.id === id ? { ...dept, ...data } : dept
      ));
      
      toast.success('Department updated successfully');
    } catch (error) {
      console.error('Failed to update department:', error);
      toast.error('Failed to update department');
    }
  }, []);

  const handleNodeDelete = useCallback(async (id: string) => {
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(dept => dept.id !== id));
      toast.success('Department deleted successfully');
    } catch (error) {
      console.error('Failed to delete department:', error);
      toast.error('Failed to delete department');
    }
  }, []);

  const handleAddChild = useCallback(async (parentId: string) => {
    // Prevent multiple simultaneous calls for the same parent
    if (isCreatingChild === parentId) {
      return;
    }
    
    setIsCreatingChild(parentId);
    try {
      const result = await createDepartment({
        name: 'New Department',
        description: '',
        upper_dept: parentId,
      });
      
      if (result.success) {
        // Fetch updated departments to get the complete department object
        const updatedDepartments = await getDepartments();
        setDepartments(updatedDepartments);
        toast.success('Child department created successfully');
      } else {
        toast.error(result.message || 'Failed to create child department');
      }
    } catch (error) {
      console.error('Failed to create child department:', error);
      toast.error('Failed to create child department');
    } finally {
      setIsCreatingChild(null);
    }
  }, [isCreatingChild]);

  const handleAddParent = useCallback(async (childId: string) => {
    // Prevent multiple simultaneous calls for the same child
    if (isCreatingParent === childId) {
      return;
    }
    
    setIsCreatingParent(childId);
    try {
      const result = await createDepartment({
        name: 'New Parent Department',
        description: '',
      });
      
      if (result.success) {
        // Update the child to have this new parent
        const updateResult = await updateDepartment({
          id: childId,
          name: departments.find(d => d.id === childId)?.name || '',
          upper_dept: result.id,
        });
        
        if (updateResult.success) {
          // Fetch updated departments to get the complete department objects
          const updatedDepartments = await getDepartments();
          setDepartments(updatedDepartments);
          toast.success('Parent department created successfully');
        } else {
          toast.error(updateResult.message || 'Failed to update child department');
        }
      } else {
        toast.error(result.message || 'Failed to create parent department');
      }
    } catch (error) {
      console.error('Failed to create parent department:', error);
      toast.error('Failed to create parent department');
    } finally {
      setIsCreatingParent(null);
    }
  }, [isCreatingParent, departments]);

  // Convert departments to nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node<DepartmentNodeData>[] = [];
    const edges: Edge[] = [];

    // Create nodes for each department
    departments.forEach((dept) => {
      nodes.push({
        id: dept.id,
        type: 'department',
        position: { x: 0, y: 0 },
        data: {
          id: dept.id,
          name: dept.name || '',
          description: dept.description || '',
          assignedJobs: [], // TODO: Map from dept jobs or implement job assignment logic
          onUpdate: handleNodeUpdate,
          onDelete: handleNodeDelete,
          onAddChild: handleAddChild,
          onAddParent: handleAddParent,
          availableJobs,
          isCreatingChild: isCreatingChild === dept.id,
          isCreatingParent: isCreatingParent === dept.id,
        },
      });

      // Create edges for parent-child relationships
      if (dept.upper_dept) {
        edges.push({
          id: `${dept.upper_dept}-${dept.id}`,
          source: dept.upper_dept,
          target: dept.id,
          type: 'smoothstep',
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [departments, availableJobs, handleNodeUpdate, handleNodeDelete, handleAddChild, handleAddParent]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when departments change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTimeout(() => fitView(), 100);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        type: 'smoothstep',
      };
      setEdges((eds) => addEdge(edge, eds));
      
      // Update the database relationship
      if (params.source && params.target) {
        const targetDept = departments.find(d => d.id === params.target);
        if (targetDept) {
          updateDepartment({
            id: params.target,
            name: targetDept.name,
            upper_dept: params.source,
          });
          setDepartments(prev => prev.map(dept => 
            dept.id === params.target ? { ...dept, upper_dept: params.source } : dept
          ));
        }
      }
    },
    [setEdges, departments]
  );

  const handleAddRootDepartment = useCallback(async () => {
    try {
      const result = await createDepartment({
        name: 'Root Department',
        description: '',
      });
      
      if (result.success) {
        // Fetch updated departments to get the complete department object
        const updatedDepartments = await getDepartments();
        setDepartments(updatedDepartments);
        toast.success('Root department created successfully');
      } else {
        toast.error(result.message || 'Failed to create root department');
      }
    } catch (error) {
      console.error('Failed to create root department:', error);
      toast.error('Failed to create root department');
    }
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        key={`flow-${departments.length}-${departments.map(d => `${d.id}-${d.upper_dept}`).join('-')}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="top-right"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      
      {departments.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No departments found</p>
            <button
              onClick={handleAddRootDepartment}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create First Department
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrganizationChart(props: OrganizationChartProps) {
  return (
    <ReactFlowProvider>
      <OrganizationChartInner {...props} />
    </ReactFlowProvider>
  );
}