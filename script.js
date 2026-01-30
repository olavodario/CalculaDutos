document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const state = {
        calcMode: 'velocity', // 'velocity', 'dimensions', 'pressure'
        ductType: 'rectangular',
        segments: [],
        outlets: [], // Current segment outlets
        inputFlow: 0, // Current input flow
        remainingFlow: 0 // Flow for next segment
    };

    // --- DOM Elements ---
    const ui = {
        toggles: document.getElementById('calcModeToggles'),
        dynamicInputs: document.getElementById('dynamicInputs'),
        flowInput: document.getElementById('flowInput'),
        ductType: document.getElementById('ductType'),
        optionalHeight: document.getElementById('optionalHeight'),

        // Dynamic Inputs
        maxVelocity: document.getElementById('maxVelocity'),
        targetPressure: document.getElementById('targetPressure'),
        fixedWidth: document.getElementById('fixedWidth'),
        fixedHeight: document.getElementById('fixedHeight'),
        dim1Label: document.getElementById('dim1Label'),
        heightInputContainer: document.getElementById('heightInputContainer'),

        // Results
        resDimensions: document.getElementById('resDimensions'),
        resVelocity: document.getElementById('resVelocity'),
        resDiameter: document.getElementById('resDiameter'),
        resPressure: document.getElementById('resPressure'),

        // Outlets
        outletId: document.getElementById('outletId'),
        outletType: document.getElementById('outletType'),
        outletQty: document.getElementById('outletQty'),
        outletFlow: document.getElementById('outletFlow'),
        addOutletBtn: document.getElementById('addOutletBtn'),
        outletsList: document.getElementById('outletsList'),
        totalDeduction: document.getElementById('totalDeduction'),

        // Actions
        saveSegmentBtn: document.getElementById('saveSegmentBtn'),
        segmentsList: document.getElementById('segmentsList'),
        genReportBtn: document.getElementById('generateReportBtn'),
        downloadLink: document.getElementById('downloadLink')
    };

    // --- Event Listeners ---

    // Toggle Calculation Mode
    ui.toggles.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            setMode(e.target.dataset.mode);
        }
    });

    // Inputs Change -> Recalculate
    const inputs = [
        ui.flowInput, ui.ductType, ui.optionalHeight,
        ui.maxVelocity, ui.targetPressure, ui.fixedWidth, ui.fixedHeight
    ];
    inputs.forEach(input => {
        input.addEventListener('input', calculate);
        input.addEventListener('change', calculate);
    });

    // Outlet Management
    ui.addOutletBtn.addEventListener('click', addOutlet);
    ui.saveSegmentBtn.addEventListener('click', saveSegment);
    ui.genReportBtn.addEventListener('click', generateReport);

    // --- Core Logic ---

    function setMode(mode) {
        state.calcMode = mode;

        // Update Toggles
        Array.from(ui.toggles.children).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Show/Hide Inputs
        Array.from(ui.dynamicInputs.children).forEach(div => {
            div.classList.toggle('hidden', div.dataset.modeInput !== mode);
        });

        // Dimensions Mode specific labels
        if (mode === 'dimensions') {
            updateDimensionInputs();
        }

        calculate();
    }

    function updateDimensionInputs() {
        const type = ui.ductType.value;
        if (type === 'circular') {
            ui.dim1Label.textContent = 'Diâmetro (mm)';
            ui.heightInputContainer.classList.add('hidden');
        } else {
            ui.dim1Label.textContent = 'Largura (mm)';
            ui.heightInputContainer.classList.remove('hidden');
        }
    }

    // Keep Dimension Inputs synced with Duct Type changes
    ui.ductType.addEventListener('change', () => {
        updateDimensionInputs();
        // Also handling optional height visibility
        if (ui.ductType.value === 'square' || ui.ductType.value === 'circular') {
            document.getElementById('optionalHeightGroup').classList.add('hidden');
        } else {
            document.getElementById('optionalHeightGroup').classList.remove('hidden');
        }
        calculate();
    });


    function calculate() {
        // 1. Get Base Values
        const Q_h = parseFloat(ui.flowInput.value) || 0;
        // Convert Flow to m3/s
        const Q_s = Q_h / 3600;

        if (Q_s <= 0) {
            clearResults();
            return;
        }

        const type = ui.ductType.value;
        const mode = state.calcMode;

        let width = 0, height = 0, diameter = 0; // mm
        let velocity = 0; // m/s
        let area = 0; // m2

        // Constants from Spreadsheet (Specific to User Scope)
        // DENSITY = 1.034 kg/m3 (High Altitude?)
        // VISCOSITY = 0.00001557 Pa.s
        // ROUGHNESS = 0.00015 m (Galvanized)
        // SAFETY MARGIN (Accessory Loss?) = +0.35 Pa/m fixed addition

        const density = 1.034;
        const viscosity = 0.00001557;
        const roughness = 0.00015;
        const pressureMargin = 0.35;

        // Helper: Calc Friction Pressure Drop (Darcy-Weisbach)
        // Returns Pa/m (Friction only)
        function calcFrictionDrop(A_m2, Dh_m) {
            if (A_m2 <= 0 || Dh_m <= 0) return 0;
            const v = Q_s / A_m2;
            const Re = (density * v * Dh_m) / viscosity;

            // Friction Factor (Altshul-Tsal approx for turbulent/transition)
            // f = 0.11 * ( (eps/Dh) + (68/Re) ) ^ 0.25
            const term1 = roughness / Dh_m;
            const term2 = 68 / Re;
            const f = 0.11 * Math.pow(term1 + term2, 0.25);

            const pd = 0.5 * density * v * v; // Dynamic Pressure
            return f * (1 / Dh_m) * pd;
        }

        // --- CALCULATION INPUTS ---

        if (mode === 'velocity') {
            const v_max = parseFloat(ui.maxVelocity.value) || 0;
            if (v_max <= 0) return;

            area = Q_s / v_max; // m2

            if (type === 'rectangular' || type === 'oval') {
                const h_fix = parseFloat(ui.optionalHeight.value) || 0;
                if (h_fix > 0) {
                    height = h_fix;
                    width = (area * 1e6) / height;
                } else {
                    // Default to Square ratio
                    const side = Math.sqrt(area) * 1000;
                    width = side; height = side;
                }
            } else if (type === 'square') {
                width = Math.sqrt(area) * 1000;
                height = width;
            } else if (type === 'circular') {
                diameter = Math.sqrt((4 * area) / Math.PI) * 1000;
            }

        } else if (mode === 'dimensions') {
            if (type === 'circular') {
                diameter = parseFloat(ui.fixedWidth.value) || 0;
                if (diameter <= 0) return;
                area = (Math.PI * Math.pow(diameter / 1000, 2)) / 4;
            } else {
                width = parseFloat(ui.fixedWidth.value) || 0;
                height = parseFloat(ui.fixedHeight.value) || 0;
                if (type === 'square') height = width;
                if (width <= 0 || (height <= 0 && type !== 'square')) return;
                area = (width / 1000) * (height / 1000);
            }
            velocity = Q_s / area;

        } else if (mode === 'pressure') {
            const dp_target_total = parseFloat(ui.targetPressure.value) || 0;
            if (dp_target_total <= 0) return;

            // Target Friction Drop = Total Target - Margin
            let dp_target_friction = dp_target_total - pressureMargin;

            // If target is very low (below margin), we assume minimal constraint or error.
            // But realistically we need positive friction. 
            // Setting a minimal floor for calc loop.
            if (dp_target_friction <= 0.001) dp_target_friction = 0.001;

            // Binary Search Range (0.05m to 3.0m)
            let minD = 0.05, maxD = 5.0;
            let bestD = maxD;

            for (let i = 0; i < 30; i++) {
                const midD = (minD + maxD) / 2;
                let testA, testDh;

                if (type === 'circular') {
                    testA = Math.PI * midD * midD / 4;
                    testDh = midD;
                } else {
                    const h_fix = parseFloat(ui.optionalHeight.value) || 0;
                    if (h_fix > 0 && (type === 'rectangular' || type === 'oval')) {
                        const h_m = h_fix / 1000;
                        let w_m = midD;
                        testA = w_m * h_m;
                        testDh = (2 * w_m * h_m) / (w_m + h_m);
                    } else {
                        // Square Aspect
                        testA = midD * midD;
                        testDh = midD;
                    }
                }

                const dP = calcFrictionDrop(testA, testDh);

                if (dP > dp_target_friction) {
                    minD = midD; // Drop too high -> need larger duct
                } else {
                    maxD = midD; // Drop low -> can be smaller
                }
                bestD = midD;
            }

            // Set final dimensions
            if (type === 'circular') {
                diameter = bestD * 1000;
                area = Math.PI * bestD * bestD / 4;
            } else {
                const h_fix = parseFloat(ui.optionalHeight.value) || 0;
                if (h_fix > 0 && (type === 'rectangular' || type === 'oval')) {
                    height = h_fix;
                    width = bestD * 1000;
                    area = (width / 1000) * (height / 1000);
                } else {
                    width = bestD * 1000;
                    height = bestD * 1000;
                    area = bestD * bestD;
                }
            }
        }

        // --- FINAL CALCS & OUTPUT ---

        // Ensure Dimensions
        if (velocity === 0 && area > 0) velocity = Q_s / area;

        // Finalize Shape
        if (type === 'circular') {
            width = diameter; height = diameter;
        }

        // Equivalent Diameter Calc
        let Dh_m = 0;
        let De = 0;

        if (type === 'circular') {
            Dh_m = diameter / 1000;
            De = diameter;
        } else {
            // Rect/Square
            const a = width / 1000;
            const b = height / 1000;
            if (a > 0 && b > 0) {
                Dh_m = (2 * a * b) / (a + b);
                De = 1.30 * Math.pow((a * b) ** 0.625 / (a + b) ** 0.25, 1) * 1000;
            }
        }

        // Oval Approx:
        if (type === 'oval') {
            const a = width / 1000;
            const b = height / 1000;
            if (a > 0 && b > 0) {
                Dh_m = (2 * a * b) / (a + b);
                De = 1.30 * Math.pow((a * b) ** 0.625 / (a + b) ** 0.25, 1) * 1000;
            }
        }

        // Final Pressure Drop Calc
        const pressDropFric = calcFrictionDrop(area, Dh_m);
        const totalPressDrop = pressDropFric + pressureMargin;

        // Update UI
        updateResults({
            width: width,
            height: height,
            diameter: diameter,
            velocity: velocity,
            De: De,
            pressDrop: totalPressDrop,
            ductType: type
        });

        // Store
        window.currentCalc = {
            width, height, diameter, velocity, De, pressDrop: totalPressDrop, Q_h, type
        };
    }

    function updateResults(res) {
        if (res.ductType === 'circular') {
            ui.resDimensions.textContent = `Ø ${res.diameter.toFixed(0)}`;
        } else {
            ui.resDimensions.textContent = `${res.width.toFixed(0)} x ${res.height.toFixed(0)}`;
        }

        ui.resVelocity.textContent = res.velocity.toFixed(2);
        ui.resDiameter.textContent = res.De.toFixed(0);
        ui.resPressure.textContent = res.pressDrop.toFixed(3);
    }

    function clearResults() {
        ui.resDimensions.textContent = '- x -';
        ui.resVelocity.textContent = '-';
        ui.resDiameter.textContent = '-';
        ui.resPressure.textContent = '-';
    }

    // --- Outlet Logic ---
    function addOutlet() {
        const id = ui.outletId.value.trim();
        const type = ui.outletType.value;
        const qty = parseInt(ui.outletQty.value) || 1;
        const flow = parseFloat(ui.outletFlow.value) || 0;

        if (!id || flow <= 0) return alert('Preencha ID e Vazão.');

        const total = qty * flow;
        const outlet = { id, type, qty, flow, total };

        state.outlets.push(outlet);
        renderOutlets();

        // Reset Inputs
        ui.outletId.value = '';
        ui.outletFlow.value = '';
        ui.outletId.focus();
    }

    function renderOutlets() {
        ui.outletsList.innerHTML = '';
        let totalDed = 0;

        if (state.outlets.length === 0) {
            ui.outletsList.innerHTML = '<div class="empty-state">Nenhuma saída adicionada neste trecho.</div>';
        } else {
            state.outlets.forEach((o, index) => {
                totalDed += o.total;
                const div = document.createElement('div');
                div.className = 'outlet-item';
                div.innerHTML = `
                    <span><strong>${o.id}</strong> (${o.type}) - ${o.qty}x ${o.flow} m³/h</span>
                    <span>Total: ${o.total} <span class="outlet-delete" onclick="removeOutlet(${index})">✖</span></span>
                `;
                ui.outletsList.appendChild(div);
            });
        }

        ui.totalDeduction.textContent = totalDed;
        state.totalDeduction = totalDed;
    }

    window.removeOutlet = (index) => {
        state.outlets.splice(index, 1);
        renderOutlets();
    };

    // --- Segment Logic ---
    function saveSegment() {
        if (!window.currentCalc) return alert('Realize um cálculo primeiro.');

        const calc = window.currentCalc;

        // Check Aspect Ratio
        if (calc.type === 'rectangular' || calc.type === 'oval') {
            const w = calc.width;
            const h = calc.height;
            if (w > 0 && h > 0) {
                const ratio = Math.max(w / h, h / w);
                if (ratio > 4) {
                    if (!confirm(`ATENÇÃO: A relação entre lados (${ratio.toFixed(1)}:1) é superior ao recomendado (4:1).\n\nDeseja salvar mesmo assim?`)) {
                        return; // Cancel save
                    }
                }
            }
        }

        const segment = {
            id: state.segments.length + 1,
            flow: calc.Q_h,
            type: calc.type,
            dimensions: calc.type === 'circular' ? `Ø${calc.diameter.toFixed(0)}` : `${calc.width.toFixed(0)}x${calc.height.toFixed(0)}`,
            velocity: calc.velocity.toFixed(2),
            pressure: calc.pressDrop.toFixed(3),
            outlets: [...state.outlets],
            deduction: state.totalDeduction || 0
        };

        state.segments.push(segment);
        renderSegments();

        // Calc remaining flow for next segment
        const remaining = Math.max(0, calc.Q_h - segment.deduction);

        // Setup next
        ui.flowInput.value = remaining;
        state.outlets = [];
        renderOutlets();

        // Trigger recalc
        calculate();
    }

    function renderSegments() {
        ui.segmentsList.innerHTML = '';
        state.segments.slice().reverse().forEach(seg => {
            const div = document.createElement('div');
            div.className = 'segment-item';
            div.innerHTML = `
                <div class="segment-header">
                    <span>#${seg.id} - ${seg.flow} m³/h</span>
                    <span>${seg.dimensions}</span>
                </div>
                <div class="segment-details">
                    V: ${seg.velocity} m/s | ΔP: ${seg.pressure} Pa/m
                    <br>
                    Saídas: ${seg.outlets.length} (Total -${seg.deduction} m³/h)
                </div>
            `;
            ui.segmentsList.appendChild(div);
        });
    }

    // --- Report (XLSX) ---
    function generateReport() {
        if (state.segments.length === 0) return alert('Nenhum trecho para gerar relatório.');

        // Prepare Data for Excel
        const rows = [];

        state.segments.forEach(seg => {
            const rowBase = {
                'ID Trecho': seg.id,
                'Vazão Trecho (m³/h)': seg.flow,
                'Tipo Duto': seg.type,
                'Dimensões': seg.dimensions,
                'Velocidade (m/s)': seg.velocity,
                'Perda de Carga (Pa/m)': seg.pressure,
                'Total Saídas (Qtd)': seg.outlets.length,
                'Vazão Redução (m³/h)': seg.deduction
            };

            if (seg.outlets.length === 0) {
                rows.push({
                    ...rowBase,
                    'ID Saída': '-',
                    'Tipo Saída': '-',
                    'Qtd Saída': '-',
                    'Vazão Un. (m³/h)': '-',
                    'Vazão Total (m³/h)': '-'
                });
            } else {
                seg.outlets.forEach(out => {
                    rows.push({
                        ...rowBase,
                        'ID Saída': out.id,
                        'Tipo Saída': out.type,
                        'Qtd Saída': out.qty,
                        'Vazão Un. (m³/h)': out.flow,
                        'Vazão Total (m³/h)': out.total
                    });
                });
            }
        });

        // Create Worksheet
        const ws = XLSX.utils.json_to_sheet(rows);

        // Auto-width columns
        const wscols = Object.keys(rows[0]).map(k => ({ wch: 20 }));
        ws['!cols'] = wscols;

        // Create Workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório Dutos");

        // Generate File
        XLSX.writeFile(wb, `Relatorio_Dutos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
});
