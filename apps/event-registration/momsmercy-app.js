
        // Global Application State
        const state = {
            fullName: '',
            age: '',
            gender: '',
            email: '',
            whatsapp: '',
            category: 'Student',
            unitPrice: 149,
            quantity: 1,
            totalAmount: 149,
            utr: '',
            screenshotBase64: '',
            regId: ''
        };

        const PAYEE_UPI_ID = "sathish.zeeind-1@okicici";

        let paymentQRCodeObj = null;
        let passQRCodeObj = null;

        // Custom Notification Function replacing alert()
        function showNotice(title, message, isError = true) {
            document.getElementById('dialogTitle').textContent = title;
            document.getElementById('dialogMessage').textContent = message;
            const iconDiv = document.getElementById('dialogIcon');
            
            if (isError) {
                iconDiv.className = "w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl border border-rose-500/30";
                iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            } else {
                iconDiv.className = "w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl border border-emerald-500/30";
                iconDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            }

            document.getElementById('customDialog').classList.remove('hidden');
        }

        function closeDialog() {
            document.getElementById('customDialog').classList.add('hidden');
        }

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
                state.unitPrice = parseInt(selectedCategoryRadio.getAttribute('data-price')) || 149;
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
            state.email = document.getElementById('email').value.trim();
            state.whatsapp = document.getElementById('whatsapp').value.trim();

            if (!state.fullName || !state.age || !state.gender || !state.email || !state.whatsapp) {
                showNotice("Incomplete Form", "Please fill in all participant details including email.");
                return;
            }

            // Populate Step 2 Summaries
            document.getElementById('summaryName').textContent = state.fullName;
            document.getElementById('summaryEmail').textContent = state.email;
            document.getElementById('summaryCategory').textContent = `${state.category} Pass (${state.quantity} x ₹${state.unitPrice})`;
            document.getElementById('summaryPhone').textContent = `+91 ${state.whatsapp}`;
            document.getElementById('paymentAmountDisplay').textContent = `₹${state.totalAmount}`;

            // Generate Dynamic UPI URI string
            const pn = encodeURIComponent("Anticlock Sports Academy");
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
            const pn = encodeURIComponent("Anticlock Sports Academy");
            const upiString = `upi://pay?pa=${PAYEE_UPI_ID}&pn=${pn}&am=${state.totalAmount}&cu=INR&tn=Event%20Registration`;
            window.location.href = upiString;
        }

        // Send Pre-Formatted WhatsApp Message with Ticket Details
        function sendWhatsAppPass() {
            const message = `🏆 *ANTICLOCK SPORTS HEALTH & FITNESS ACADEMY* 🏆\n` +
                            `*State Sports & Health Championship Pass Confirmation*\n\n` +
                            `Hello *${state.fullName}*,\n` +
                            `Your registration and pass payment have been confirmed!\n\n` +
                            `🎫 *Registration ID:* ${state.regId}\n` +
                            `🏷️ *Pass Category:* ${state.category} Pass (${state.quantity} Ticket(s))\n` +
                            `💳 *Total Paid:* ₹${state.totalAmount}\n` +
                            `🧾 *Payment UTR:* ${state.utr}\n` +
                            `📧 *Email:* ${state.email}\n\n` +
                            `📍 *Note:* Present your pass QR code or ID at the entrance gate.\n` +
                            `📞 *Helpline:* 8248312112 / 7904505354\n` +
                            `✨ *WE MAKE YOU SHINE!* ✨`;

            const encodedMsg = encodeURIComponent(message);
            const waUrl = `https://api.whatsapp.com/send?phone=91${state.whatsapp}&text=${encodedMsg}`;
            window.open(waUrl, '_blank');
        }

        // Screenshot Drag and Drop & Selection Handler
        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    showNotice("File Exceeded Limit", "File size exceeds maximum limit of 5MB.");
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
                showNotice("Invalid UTR", "Please enter a valid 12-digit UTR or Transaction Reference Number.");
                return;
            }

            if (!state.screenshotBase64) {
                showNotice("Screenshot Missing", "Please attach a payment screenshot as proof.");
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
            document.getElementById('passEmail').textContent = state.email;
            document.getElementById('passPhone').textContent = `+91 ${state.whatsapp}`;
            document.getElementById('passUtr').textContent = state.utr;
            document.getElementById('passCategoryBadge').textContent = `${state.category} PASS`;

            // Populate Notification Logs
            document.getElementById('logEmail').textContent = state.email;
            document.getElementById('logPhone').textContent = `+91 ${state.whatsapp}`;

            // Set Current Timestamp
            const now = new Date();
            document.getElementById('passIssueDate').textContent = now.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            // Generate Pass Verification QR Code
            const passQrContainer = document.getElementById('passQrCode');
            passQrContainer.innerHTML = '';
            const verificationPayload = `PASS:${state.regId}|NAME:${state.fullName}|EMAIL:${state.email}|QTY:${state.quantity}|UTR:${state.utr}`;
            
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
    