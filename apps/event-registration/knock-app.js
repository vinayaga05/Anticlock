
        // Global Application State
        const state = {
            fullName: '',
            age: '',
            gender: '',
            whatsapp: '',
            category: 'Student',
            unitPrice: 99,
            quantity: 1,
            totalAmount: 99,
            utr: '',
            screenshotBase64: '',
            regId: ''
        };

        const PAYEE_UPI_ID = "sathish.zeeind-1@okicici";

        let paymentQRCodeObj = null;
        let passQRCodeObj = null;

        // Initialize Application
        window.addEventListener('DOMContentLoaded', () => {
            const defaultRadio = document.querySelector('input[name="ticketCategory"][value="Student"]');
            if (defaultRadio) {
                defaultRadio.checked = true;
            }
            calculateTotal();
        });

        // Copy UPI ID to Clipboard
        function copyUPIId() {
            const upiText = PAYEE_UPI_ID;
            const tempInput = document.createElement('input');
            tempInput.value = upiText;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            const btnLabel = document.getElementById('copyBtnLabel');
            btnLabel.textContent = 'Copied!';
            setTimeout(() => {
                btnLabel.textContent = 'Copy';
            }, 2000);
        }

        // Adjust Ticket Quantity
        function adjustQty(delta) {
            let newQty = state.quantity + delta;
            if (newQty >= 1 && newQty <= 10) {
                state.quantity = newQty;
                document.getElementById('qtyDisplay').textContent = state.quantity;
                calculateTotal();
            }
        }

        // Dynamic Fee Calculation
        function calculateTotal() {
            const selectedCategoryRadio = document.querySelector('input[name="ticketCategory"]:checked');
            if (selectedCategoryRadio) {
                state.category = selectedCategoryRadio.value;
                state.unitPrice = parseInt(selectedCategoryRadio.getAttribute('data-price')) || 99;
            }
            state.totalAmount = state.unitPrice * state.quantity;
            document.getElementById('totalFeeDisplay').textContent = `₹${state.totalAmount}`;
        }

        // Navigation between Stepper Screens
        function goToStep(stepNum) {
            document.getElementById('step1Section').classList.add('hidden');
            document.getElementById('step2Section').classList.add('hidden');
            document.getElementById('step3Section').classList.add('hidden');

            const b1 = document.getElementById('badgeStep1');
            const b2 = document.getElementById('badgeStep2');
            const b3 = document.getElementById('badgeStep3');
            const progressLine = document.getElementById('stepLineProgress');

            if (stepNum === 1) {
                document.getElementById('step1Section').classList.remove('hidden');
                progressLine.style.width = '0%';
                
                b1.className = "w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-blue-600 text-white font-bold flex items-center justify-center shadow-lg shadow-pink-500/30";
                b2.className = "w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-700 text-slate-400 font-bold flex items-center justify-center";
                b3.className = "w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-700 text-slate-400 font-bold flex items-center justify-center";
            } else if (stepNum === 2) {
                document.getElementById('step2Section').classList.remove('hidden');
                progressLine.style.width = '50%';

                b1.className = "w-9 h-9 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center shadow-lg";
                b2.className = "w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-blue-600 text-white font-bold flex items-center justify-center shadow-lg shadow-pink-500/30";
                b3.className = "w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-700 text-slate-400 font-bold flex items-center justify-center";
            } else if (stepNum === 3) {
                document.getElementById('step3Section').classList.remove('hidden');
                progressLine.style.width = '100%';

                b1.className = "w-9 h-9 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center shadow-lg";
                b2.className = "w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-lg";
                b3.className = "w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-blue-600 text-white font-bold flex items-center justify-center shadow-lg shadow-pink-500/30";
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Handle Form Step 1 Submission
        function handleProceedToPayment(e) {
            e.preventDefault();
            
            const genderRadio = document.querySelector('input[name="gender"]:checked');
            state.fullName = document.getElementById('fullName').value.trim();
            state.age = document.getElementById('age').value;
            state.gender = genderRadio ? genderRadio.value : '';
            state.whatsapp = document.getElementById('whatsapp').value.trim();

            if (!state.fullName || !state.age || !state.gender || !state.whatsapp) {
                alert("Please fill in all participant details.");
                return;
            }

            // Populate Step 2 Summaries
            document.getElementById('summaryName').textContent = state.fullName;
            document.getElementById('summaryCategory').textContent = `${state.category} Pass (${state.quantity} x ₹${state.unitPrice})`;
            document.getElementById('summaryPhone').textContent = `+91 ${state.whatsapp}`;
            document.getElementById('paymentAmountDisplay').textContent = `₹${state.totalAmount}`;

            // Generate Dynamic UPI URI string
            const pn = encodeURIComponent("Anticlock Sports");
            const upiString = `upi://pay?pa=${PAYEE_UPI_ID}&pn=${pn}&am=${state.totalAmount}&cu=INR&tn=Event%20Registration`;

            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            paymentQRCodeObj = new QRCode(qrContainer, {
                text: upiString,
                width: 170,
                height: 170,
                colorDark: "#030712",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            goToStep(2);
        }

        // Trigger Direct Mobile Payment Intent Links
        function triggerUPIIntent(appName) {
            const pn = encodeURIComponent("Anticlock Sports");
            const upiString = `upi://pay?pa=${PAYEE_UPI_ID}&pn=${pn}&am=${state.totalAmount}&cu=INR&tn=Event%20Registration`;
            window.location.href = upiString;
        }

        // Screenshot Drag and Drop & Selection Handler
        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert("File size exceeds maximum limit of 5MB.");
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(evt) {
                    state.screenshotBase64 = evt.target.result;
                    document.getElementById('imagePreview').src = evt.target.result;
                    document.getElementById('fileName').textContent = file.name;
                    document.getElementById('uploadPrompt').classList.add('hidden');
                    document.getElementById('previewContainer').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        function removeImage(e) {
            if(e) e.stopPropagation();
            state.screenshotBase64 = '';
            document.getElementById('fileInput').value = '';
            document.getElementById('uploadPrompt').classList.remove('hidden');
            document.getElementById('previewContainer').classList.add('hidden');
        }

        // Handle Step 2 Payment Verification & Issue Pass
        function handleVerifyAndGeneratePass(e) {
            e.preventDefault();

            const utrVal = document.getElementById('utrNumber').value.trim();
            if (utrVal.length !== 12 || isNaN(utrVal)) {
                alert("Please enter a valid 12-digit UTR/Transaction Reference Number.");
                return;
            }

            if (!state.screenshotBase64) {
                alert("Please attach payment screenshot proof.");
                return;
            }

            state.utr = utrVal;

            // Generate unique Registration ID
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            state.regId = `ACHFA-2026-${randomNum}`;

            // Populate Printable Pass Data
            document.getElementById('passName').textContent = state.fullName;
            document.getElementById('passRegId').textContent = state.regId;
            document.getElementById('passAgeGender').textContent = `${state.age} Yrs / ${state.gender}`;
            document.getElementById('passPhone').textContent = `+91 ${state.whatsapp}`;
            document.getElementById('passUtr').textContent = state.utr;
            document.getElementById('passQty').textContent = `${state.quantity} Ticket(s)`;
            document.getElementById('passCategoryBadge').textContent = `${state.category} PASS`;

            // Set Current Timestamp
            const now = new Date();
            document.getElementById('passIssueDate').textContent = now.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            // Generate Pass Verification QR Code
            const passQrContainer = document.getElementById('passQrCode');
            passQrContainer.innerHTML = '';
            const verificationPayload = `PASS:${state.regId}|NAME:${state.fullName}|QTY:${state.quantity}|UTR:${state.utr}`;
            
            passQRCodeObj = new QRCode(passQrContainer, {
                text: verificationPayload,
                width: 85,
                height: 85,
                colorDark: "#030712",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });

            goToStep(3);
        }

        // Reset App Form
        function resetForm() {
            document.getElementById('regForm').reset();
            document.getElementById('paymentValidationForm').reset();
            state.quantity = 1;
            state.screenshotBase64 = '';
            document.getElementById('qtyDisplay').textContent = '1';
            
            removeImage();
            
            const defaultRadio = document.querySelector('input[name="ticketCategory"][value="Student"]');
            if (defaultRadio) defaultRadio.checked = true;

            calculateTotal();
            goToStep(1);
        }
    