function(instance, properties) {
  const canvas = instance.canvas && instance.canvas[0];
  if (!canvas) return;
  const card = function(name, role, w) {
    return '<div style="width:' + (w || 150) + 'px;background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:12px;box-shadow:0 8px 20px rgba(15,23,42,.09);padding:10px 12px;position:relative;overflow:hidden;flex:0 0 auto">' +
      '<div style="position:absolute;top:0;left:12px;right:12px;height:3px;border-radius:0 0 4px 4px;background:#4f46e5"></div>' +
      '<div style="display:flex;align-items:center;gap:9px">' +
      '<div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#c7d2fe,#818cf8);flex:0 0 auto"></div>' +
      '<div style="min-width:0"><div style="font-weight:700;font-size:11.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>' +
      '<div style="font-size:9.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + role + '</div></div></div></div>';
  };
  canvas.innerHTML =
    '<div style="width:100%;height:100%;min-height:200px;position:relative;overflow:hidden;background:#f6f8fb;background-image:radial-gradient(rgba(15,23,42,.055) 1px,transparent 1px);background-size:20px 20px;font-family:Inter,system-ui,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px">' +
    '<div style="position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,.85);border:1px solid rgba(15,23,42,.08);border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.08)">' +
    '<div style="flex:0 1 160px;height:26px;border:1px solid rgba(15,23,42,.1);border-radius:8px;background:#fff;display:flex;align-items:center;padding:0 9px;color:#94a3b8;font-size:10px">Pesquisar...</div>' +
    '<span style="flex:1"></span>' +
    '<div style="width:26px;height:26px;border-radius:8px;background:rgba(15,23,42,.05)"></div>' +
    '<div style="width:26px;height:26px;border-radius:8px;background:rgba(15,23,42,.05)"></div>' +
    '<div style="width:44px;height:26px;border-radius:8px;background:#4f46e5"></div>' +
    '</div>' +
    '<div style="margin-top:34px">' + card("Ana Martins", "CEO", 160) + '</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">' +
    card("Bruno Costa", "Diretor Comercial") + card("Carla Dias", "Diretora de Operações") + card("Diego Rocha", "Diretor de Tecnologia") +
    '</div>' +
    '<div style="position:absolute;bottom:8px;right:12px;font-size:9px;font-weight:600;color:#94a3b8">OrgChart Pro</div>' +
    '</div>';
}
