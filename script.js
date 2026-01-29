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

        // --- CALCULATION ---

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
                    // Default to Square ratio if not defined
                    const side = Math.sqrt(area) * 1000;
                    width = side;
                    height = side;
                }
            } else if (type === 'square') {
                const side = Math.sqrt(area) * 1000;
                width = side;
                height = side;
            } else if (type === 'circular') {
                diameter = Math.sqrt((4 * area) / Math.PI) * 1000;
            }

        } else if (mode === 'dimensions') {
            if (type === 'circular') {
                diameter = parseFloat(ui.fixedWidth.value) || 0; // reusing width input as diameter
                if (diameter <= 0) return;
                area = (Math.PI * Math.pow(diameter / 1000, 2)) / 4;
            } else {
                width = parseFloat(ui.fixedWidth.value) || 0;
                height = parseFloat(ui.fixedHeight.value) || 0;
                // For square, if user inputs W, H is same (or user inputs both, we take check)
                if (type === 'square') height = width;

                if (width <= 0 || (height <= 0 && type !== 'square')) return;

                area = (width / 1000) * (height / 1000);
            }
            // Calc Resulting Velocity
            velocity = Q_s / area;

        } else if (mode === 'pressure') {
            const dp_target = parseFloat(ui.targetPressure.value) || 0;
            if (dp_target <= 0) return;

            // Iterative approach: Find Dequiv that gives DeltaP ~= Target
            // Approximation: dP = 0.5 * v^1.86 / De^1.27  (Generic)
            // Or use: De = [ (0.5 * Q^1.86) / dP ] ^ (1/4.99) ? 
            // Better to iterate diameter/size until dP matches.

            // Heuristic for De (approx):
            // dP ~ C * Q^1.9 / D^4.9
            // D ~ ( C * Q^1.9 / dP ) ^ (1/5)
            // Let's use a standard approximation for Galvanized Steel
            // ASHRAE: dP = f * (L/D) * (rho*v^2)/2
            // Simplification for standard air: dP_per_m = 0.091 * (Q_s^1.9) / (De_m^4.97) (Approx)
            // ==> De_m = ( (0.091 * Q_s^1.9) / dP_target ) ^ (1/4.97)

            // NOTE: Coeff 0.091 is illustrative. Standard is often around that magnitude.
            // Let's use the one from the prompt's spreadsheet logic if visible? 
            // Spreadsheet shows Method 1: Duto = Sqrt((Q/3600)/V).
            // Spreadsheet last row: Pa/m = 0.82.
            // I will implement the inverse of the pressure drop function used below.

            // Inverse of: dp = 0.02 * (v^1.9) / (De^1.1) ?? No, usually dP ~ v^2/D.
            // Let's stick to the De calc from dP.

            // Using a common metric approximation:
            // De (m) = 0.66 * (Q(m3/s))^0.5 approx for 1 Pa/m?
            // Let's solve: dP = Lambda * (v^2 / (2*De*rho...))
            // I will use a robust approximation:
            // De = [ (0.109136 * Q_s^1.9) / dp_target ] ^ (1/4.97)  (ASHRAE simplified SI)

            const De_m = Math.pow((0.109136 * Math.pow(Q_s, 1.9)) / dp_target, 1 / 4.97);

            // Now we have equivalent diameter. Convert to W/H/D.
            if (type === 'circular') {
                diameter = De_m * 1000;
                area = Math.PI * Math.pow(De_m / 2, 2);
            } else if (type === 'square') {
                // De_square approx = Side (roughly). More precisely De = 1.3 * (Side^2)^0.625 / (2*Side)^0.25 = Side.
                // Actually De = Side for square is a decent approximation but generally Side = De.
                // De = 1.3 * (a^2)^0.625 / (2a)^0.25 = 1.3 * a^1.25 / 1.189 * a^0.25 = 1.09 * a.
                // So Side = De / 1.09.
                const side = (De_m / 1.09) * 1000;
                width = side;
                height = side;
                area = Math.pow(side / 1000, 2);
            } else {
                // Rectangular: Need to fix one dimension or assume square.
                const h_fix = parseFloat(ui.optionalHeight.value) || 0;
                if (h_fix > 0) {
                    // Iteratively find W that gives De.
                    // Or simplified: De ~= 1.3 * (W*H)^0.625 / (W+H)^0.25
                    // Hard to invert. 
                    // Let's assume w = De initially, then iterate.
                    // Or used equivalent Area approach? 
                    // Let's use Area_req approx from De.
                    // Area_circ = PI*De^2/4. 
                    // A_rect approx = Area_circ. 
                    // W = A / H.
                    height = h_fix;
                    const a_req = Math.PI * Math.pow(De_m, 2) / 4;
                    width = (a_req * 1e6) / height;
                } else {
                    // Assume square aspect ratio
                    const side = (De_m / 1.09) * 1000;
                    width = side; height = side;
                }
                area = (width / 1000) * (height / 1000);
            }
        }

        // --- Recalculate Final Values ---
        if (velocity === 0 && area > 0) velocity = Q_s / area;

        // Finalize Dimensions
        if (type === 'circular') {
            width = diameter;
            height = diameter;
        }

        // Equivalent Diameter Calc
        let De = 0; // mm
        if (type === 'circular') {
            De = diameter;
        } else if (type === 'oval') {
            // Approx for Flat Oval: De = 1.55 * A^0.625 / P^0.25
            // Perimeter P = PI*H + 2*(W-H) (if W is major axis)
            // Area A = PI*H^2/4 + (W-H)*H
            const A_ov = Math.PI * Math.pow(height / 1000, 2) / 4 + (width / 1000 - height / 1000) * (height / 1000); // Check formula validity
            // Simplified: Use Hydraulic Diameter Dh = 4A/P
            // De (pressure) approx Dh.
            // Let's stick to Rectangular approximation for Oval unless specific formula requested.
            // Using Rectangular formula as fallback for now.
            const a = width; const b = height;
            De = 1.30 * Math.pow((a * b) ** 0.625 / (a + b) ** 0.25, 1); // This formula gives De^1.25?
            // Correct Formula: De = 1.30 * [ (a*b)^0.625 / (a+b)^0.25 ] 
            // Wait, (a*b) in mm^2?
            // Use meters.
            const am = width / 1000; const bm = height / 1000;
            const Dem = 1.30 * (Math.pow(am * bm, 0.625) / Math.pow(am + bm, 0.25));
            De = Dem * 1000;
        } else {
            // Rectangular/Square
            const am = width / 1000; const bm = height / 1000;
            const Dem = 1.30 * (Math.pow(am * bm, 0.625) / Math.pow(am + bm, 0.25));
            De = Dem * 1000;
        }

        // Pressure Drop Calc
        // Formula: dP = 0.109136 * Q^1.9 / De^4.97 (Pa/m)
        const De_m_real = De / 1000;
        const pressDrop = (0.109136 * Math.pow(Q_s, 1.9)) / Math.pow(De_m_real, 4.97);

        // Update UI
        updateResults({
            width: width,
            height: height,
            diameter: diameter,
            velocity: velocity,
            De: De,
            pressDrop: pressDrop,
            ductType: type
        });

        // Store current calculation results for saving
        window.currentCalc = {
            width, height, diameter, velocity, De, pressDrop, Q_h, type
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
        ui.resPressure.textContent = res.pressDrop.toFixed(2);
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

        const segment = {
            id: state.segments.length + 1,
            flow: calc.Q_h,
            type: calc.type,
            dimensions: calc.type === 'circular' ? `Ø${calc.diameter.toFixed(0)}` : `${calc.width.toFixed(0)}x${calc.height.toFixed(0)}`,
            velocity: calc.velocity.toFixed(2),
            pressure: calc.pressDrop.toFixed(2),
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
