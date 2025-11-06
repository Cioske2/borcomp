// Bootstrap recognition plugin
export const bootstrapPlugin = {
  id: 'bootstrap',
  name: 'Bootstrap',
  detect(node, ctx){
    const cls = (node.attrs?.class || '').split(/\s+/).filter(Boolean);
    const suggestions = [];
    const has = (c) => cls.some(x => x === c || x.startsWith(c+'-'));
    const push = (component, confidence, reason) => suggestions.push({ framework:'Bootstrap', component, confidence, reason, path: ctx.path });

    if (has('navbar')) push('Navbar', 0.95, 'class contains navbar');
    if (has('btn')) push('Button', 0.9, 'class contains btn');
    if (has('card')) push('Card', 0.9, 'class contains card');
    if (has('modal')) push('Modal', 0.85, 'class contains modal');
    if (has('alert')) push('Alert', 0.8, 'class contains alert');
    if (has('badge')) push('Badge', 0.7, 'class contains badge');
    if (has('list-group')) push('ListGroup', 0.75, 'class contains list-group');
    if (has('dropdown')) push('Dropdown', 0.75, 'class contains dropdown');
    if (has('form-control')) push('FormControl', 0.65, 'class contains form-control');
    if (cls.some(c=>/^col(-sm|-md|-lg|-xl)?-\d+/.test(c))) push('GridCol', 0.6, 'Bootstrap grid column');
    if (cls.includes('row')) push('GridRow', 0.6, 'Bootstrap grid row');

    return suggestions;
  }
};
