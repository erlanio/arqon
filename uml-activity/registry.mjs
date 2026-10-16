export const NODE_GROUPS = [
  ['control', 'Nós de controle'], ['actions', 'Ações'], ['objects', 'Nós de objeto'],
  ['structures', 'Estruturas compostas'], ['events', 'Eventos e restrições'], ['notes', 'Anotações']
];

// The registry owns the type, metaclass and property contract used by the editor.
const row = (kind, label, group, shape, metaclass, defaults = {}) => ({kind, label, group, shape, metaclass, defaults});
export const NODE_TYPES = [
  row('initial','Initial Node','control','initial','InitialNode'),
  row('activityFinal','Activity Final','control','activity-final','ActivityFinalNode'),
  row('flowFinal','Flow Final','control','flow-final','FlowFinalNode'),
  row('decision','Decision','control','diamond','DecisionNode'),
  row('merge','Merge','control','diamond','MergeNode'),
  row('fork','Fork','control','bar','ForkNode',{orientation:'horizontal'}),
  row('join','Join','control','bar','JoinNode',{orientation:'horizontal',joinSpec:''}),
  row('action','Action','actions','action','Action',{body:''}),
  row('callBehavior','Call Behavior Action','actions','call','CallBehaviorAction',{calledActivityId:''}),
  row('callOperation','Call Operation Action','actions','call','CallOperationAction',{operation:''}),
  row('acceptEvent','Accept Event Action','actions','event','AcceptEventAction',{trigger:''}),
  row('acceptTimeEvent','Accept Time Event','actions','event-time','AcceptEventAction',{timeExpression:''}),
  row('sendSignal','Send Signal Action','actions','signal','SendSignalAction',{signal:''}),
  row('createObject','Create Object Action','actions','action','CreateObjectAction',{classifier:''}),
  row('destroyObject','Destroy Object Action','actions','action','DestroyObjectAction',{classifier:''}),
  row('readFeature','Read Structural Feature','actions','action','ReadStructuralFeatureAction',{feature:''}),
  row('writeFeature','Write Structural Feature','actions','action','WriteStructuralFeatureAction',{feature:''}),
  row('opaqueAction','Opaque Action','actions','action','OpaqueAction',{body:'',language:''}),
  row('object','Object Node','objects','object','ObjectNode',{objectType:'',multiplicity:'1',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('centralBuffer','Central Buffer','objects','buffer','CentralBufferNode',{objectType:'',multiplicity:'*',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('dataStore','Data Store','objects','store','DataStoreNode',{objectType:'',multiplicity:'*',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('inputPin','Input Pin','objects','pin','InputPin',{objectType:'',multiplicity:'1',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('outputPin','Output Pin','objects','pin','OutputPin',{objectType:'',multiplicity:'1',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('activityParameter','Activity Parameter','objects','parameter','ActivityParameterNode',{direction:'in',objectType:'',multiplicity:'1',state:'',upperBound:'',ordering:'FIFO',selection:'',transformation:''}),
  row('structured','Structured Activity','structures','container','StructuredActivityNode',{collapsed:false}),
  row('conditional','Conditional Node','structures','container','ConditionalNode',{clauses:[]}),
  row('loop','Loop Node','structures','container','LoopNode',{setup:'',test:'',body:'',variables:'',results:''}),
  row('sequence','Sequence Node','structures','container','SequenceNode',{orderedNodeIds:[]}),
  row('expansion','Expansion Region','structures','container','ExpansionRegion',{mode:'iterative',inputs:'',outputs:''}),
  row('interruptible','Interruptible Region','structures','interruptible','InterruptibleActivityRegion',{}),
  row('exceptionHandler','Exception Handler','events','handler','ExceptionHandler',{exceptionType:'',protectedNodeId:''}),
  row('timeEvent','Time Event','events','event-time','TimeEvent',{expression:''}),
  row('signalEvent','Signal Event','events','signal','SignalEvent',{signal:''}),
  row('durationConstraint','Duration Constraint','events','constraint','DurationConstraint',{expression:''}),
  row('timeConstraint','Time Constraint','events','constraint','TimeConstraint',{expression:''}),
  row('constraint','Constraint','events','constraint','Constraint',{expression:''}),
  row('note','Note / Comment','notes','note','Comment',{text:''})
];
export const NODE_REGISTRY = Object.fromEntries(NODE_TYPES.map(item => [item.kind, item]));
export const EDGE_TYPES = {
  control: {label:'Control Flow', metaclass:'ControlFlow'},
  object: {label:'Object Flow', metaclass:'ObjectFlow'}
};
export const OBJECT_KINDS = new Set(['object','centralBuffer','dataStore','inputPin','outputPin','activityParameter']);
export const CONTROL_KINDS = new Set(['initial','activityFinal','flowFinal','decision','merge','fork','join']);
export const CONTAINER_KINDS = new Set(['structured','conditional','loop','sequence','expansion','interruptible']);
export const NON_EXECUTABLE_KINDS = new Set(['note','constraint','durationConstraint','timeConstraint','timeEvent','signalEvent','exceptionHandler']);
export const DEFAULT_STEREOTYPE_NAMES = ['manual','automatic','userTask','systemTask','externalService','critical','optional','validated','databaseOperation','apiCall'];
export function defaultSize(kind) {
  if (['initial','activityFinal','flowFinal'].includes(kind)) return {w:38,h:38};
  if (['decision','merge'].includes(kind)) return {w:72,h:72};
  if (['fork','join'].includes(kind)) return {w:154,h:26};
  if (['inputPin','outputPin'].includes(kind)) return {w:88,h:38};
  if (CONTAINER_KINDS.has(kind)) return {w:270,h:170};
  return {w:164,h:66};
}
