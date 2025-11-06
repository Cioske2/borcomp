// Material UI (MUI) recognition plugin
export const muiPlugin = {
  id: 'mui',
  name: 'Material UI',
  detect(node, ctx){
    const cls = (node.attrs?.class || '').split(/\s+/).filter(Boolean);
    const suggestions = [];
    const hasMui = cls.some(c=>c.startsWith('Mui'));
    const push = (component, confidence, reason) => suggestions.push({ framework:'MUI', component, confidence, reason, path: ctx.path });

    if (hasMui){
      if (cls.some(c=>c.startsWith('MuiButton'))) push('Button', 0.95, 'MuiButton-* class found');
      if (cls.some(c=>c.startsWith('MuiTypography'))) push('Typography', 0.9, 'MuiTypography-* class found');
      if (cls.some(c=>c.startsWith('MuiCard'))) push('Card', 0.9, 'MuiCard-* class found');
      if (cls.some(c=>c.startsWith('MuiAppBar'))) push('AppBar', 0.9, 'MuiAppBar-* class found');
      if (cls.some(c=>c.startsWith('MuiToolbar'))) push('Toolbar', 0.85, 'MuiToolbar-* class found');
      if (cls.some(c=>c.startsWith('MuiGrid'))) push('Grid', 0.85, 'MuiGrid-* class found');
      if (cls.some(c=>c.startsWith('MuiList'))) push('List', 0.8, 'MuiList-* class found');
      if (cls.some(c=>c.startsWith('MuiChip'))) push('Chip', 0.8, 'MuiChip-* class found');
      if (cls.some(c=>c.startsWith('MuiDialog'))) push('Dialog', 0.85, 'MuiDialog-* class found');
    }
    return suggestions;
  }
};
