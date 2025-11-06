// Tailwind CSS recognition plugin
export const tailwindPlugin = {
  id: 'tailwind',
  name: 'Tailwind',
  detect(node, ctx){
    const clsRaw = (node.attrs?.class || '');
    const cls = clsRaw.split(/\s+/).filter(Boolean);
    const suggestions = [];
    const hasPrefix = (p) => cls.some(c=>c.startsWith(p));
    const push = (component, confidence, reason) => suggestions.push({ framework:'Tailwind', component, confidence, reason, path: ctx.path });

    // Heuristic: if many utility classes present, suggest extraction into a component or using clsx
    const utilityCount = cls.filter(c=>/(^bg-|^text-|^flex$|^grid$|^p[xytrbl]?-|^m[xytrbl]?-|^rounded|^shadow|^w-\d|^h-\d|^justify-|^items-|^gap-)/.test(c)).length;
    if (utilityCount >= 5) push('UtilityComponent', 0.8, 'multiple Tailwind utility classes detected');
    if (hasPrefix('flex') || cls.includes('flex')) push('FlexContainer', 0.7, 'flex layout');
    if (cls.includes('grid')) push('GridContainer', 0.7, 'grid layout');
    if (hasPrefix('btn-') && !cls.includes('btn')) push('ButtonVariant', 0.6, 'custom button variant utilities');
    if (cls.some(c=>/^space-[xy]-/.test(c))) push('SpacedStack', 0.6, 'uses space-x or space-y');

    return suggestions;
  }
};
