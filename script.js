"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

    const money = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    const menuToggle = $("#menuToggle");
    const mainNav = $("#mainNav");
    const header = $(".site-header");
    const progressBar = $("#scrollProgress");
    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    const toast = $("#storeToast");
    let toastTimer;

    const notify = message => {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("is-visible");

        window.clearTimeout(toastTimer);

        toastTimer = window.setTimeout(() => {
            toast.classList.remove("is-visible");
        }, 3000);
    };

    // MENU
    const closeMenu = () => {
        if (!menuToggle || !mainNav) return;

        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");
        mainNav.classList.remove("is-open");
    };

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const open =
                menuToggle.getAttribute("aria-expanded") === "true";

            menuToggle.setAttribute("aria-expanded", String(!open));
            menuToggle.setAttribute(
                "aria-label",
                open ? "Abrir menu" : "Fechar menu"
            );

            mainNav.classList.toggle("is-open", !open);
        });

        $$("a", mainNav).forEach(link => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeMenu();
        });

        document.addEventListener("click", event => {
            if (!event.target.closest(".site-header")) closeMenu();
        });
    }

    // SCROLL
    const updateScrollUI = () => {
        const scrollable =
            document.documentElement.scrollHeight - window.innerHeight;

        const progress = scrollable > 0
            ? (window.scrollY / scrollable) * 100
            : 0;

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (header) {
            header.classList.toggle("is-scrolled", window.scrollY > 20);
        }
    };

    updateScrollUI();

    window.addEventListener("scroll", updateScrollUI, {
        passive: true
    });

    // ANIMAÇÕES
    const revealElements = $$(".reveal");

    if ("IntersectionObserver" in window && !reducedMotion) {
        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -35px 0px"
            }
        );

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    } else {
        revealElements.forEach(element => {
            element.classList.add("is-visible");
        });
    }

    // NAVEGAÇÃO ENTRE SEÇÕES
    const sectionLinks = $$(".main-nav a");

    const sections = sectionLinks
        .map(link => $(link.getAttribute("href")))
        .filter(Boolean);

    if ("IntersectionObserver" in window) {
        const sectionObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    sectionLinks.forEach(link => {
                        const active =
                            link.getAttribute("href") ===
                            `#${entry.target.id}`;

                        link.classList.toggle("is-active", active);

                        if (active) {
                            link.setAttribute("aria-current", "location");
                        } else {
                            link.removeAttribute("aria-current");
                        }
                    });
                });
            },
            {
                rootMargin: "-35% 0px -55% 0px"
            }
        );

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }

    // CATÁLOGO
    let catalog;

    try {
        const response = await fetch(
            new URL("catalog.json", window.location.href),
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Não foi possível carregar o catálogo.");
        }

        catalog = await response.json();

        if (!Array.isArray(catalog.products)) {
            throw new Error("O catálogo não possui uma lista válida de produtos.");
        }
    } catch (error) {
        console.error(error);
        notify("Erro ao carregar os produtos. Verifique catalog.json.");
        return;
    }

    const products = new Map(
        catalog.products.map(product => [product.id, product])
    );

    const storageKey = "astra-store-cart-v1";

    let cart = [];

    try {
        cart = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
        cart = [];
    }

    if (!Array.isArray(cart)) cart = [];

    // ELEMENTOS DOS PRODUTOS
    const productDialog = $("#productDialog");
    const productDialogClose = $("#dialogClose");

    const dialogImage = $("#dialogImage");
    const dialogTitle = $("#dialogTitle");
    const dialogCategory = $("#dialogCategory");
    const dialogDescription = $("#dialogDescription");
    const dialogPrice = $("#dialogPrice");
    const dialogStock = $("#dialogStock");

    const sizeSelect = $("#productSize");
    const qtyOutput = $("#productQty");
    const qtyMinus = $("#productQtyMinus");
    const qtyPlus = $("#productQtyPlus");
    const addToCartButton = $("#addToCart");

    let selectedProduct = null;
    let selectedQuantity = 1;

    // ELEMENTOS DO CARRINHO
    const cartDialog = $("#cartDialog");
    const cartOpen = $("#cartOpen");
    const cartClose = $("#cartClose");

    const cartItems = $("#cartItems");
    const cartCount = $("#cartCount");
    const cartEmpty = $("#cartEmpty");
    const cartCheckout = $("#cartCheckout");

    const cartSubtotal = $("#cartSubtotal");
    const cartSubtitle = $("#cartSubtitle");
    const cartMessage = $("#cartMessage");

    const checkoutForm = $("#checkoutForm");
    const checkoutButton = $("#checkoutButton");

    const paymentSelector = $("#paymentSelector");
    const paymentInputs = $$('input[name="paymentMethod"]');

    const buyerNameInput = $("#buyerName");
    const buyerEmailInput = $("#buyerEmail");
    const buyerCpfInput = $("#buyerCpf");

    // ELEMENTOS DO PIX
    const pixPaymentPanel = $("#pixPaymentPanel");
    const pixQrImage = $("#pixQrImage");
    const pixTotal = $("#pixTotal");
    const pixKeyDisplay = $("#pixKeyDisplay");
    const pixTxid = $("#pixTxid");
    const pixCopyPaste = $("#pixCopyPaste");

    const copyPixCodeButton = $("#copyPixCode");
    const backToCheckoutButton = $("#backToCheckout");

    let currentPixPayload = "";

    // ELEMENTOS DO CARTÃO
    const cardPaymentPanel = $("#cardPaymentPanel");
    const cardPaymentBrickContainer = $("#cardPaymentBrickContainer");

    let mercadoPago = null;
    let bricksBuilder = null;
    let cardPaymentBrickController = null;
    let cardBackButton = null;

    const saveCart = () => {
        localStorage.setItem(storageKey, JSON.stringify(cart));
    };

    const getCartItem = (id, size) => {
        return cart.find(item =>
            item.id === id && item.size === size
        );
    };

    const availableForSize = (product, size) => {
        return Number(
            product.stockBySize?.[size] ??
            product.stock ??
            0
        );
    };

    const totalStock = product => {
        return Object.values(product.stockBySize || {}).reduce(
            (sum, amount) => sum + Number(amount || 0),
            0
        ) || Number(product.stock || 0);
    };

    const getCartItemsForPayment = () => {
        return cart.map(item => ({
            id: item.id,
            size: item.size,
            quantity: item.quantity
        }));
    };

    // MENSAGENS DO CHECKOUT
    function showCartMessage(message, error = false) {
        if (!cartMessage) return;

        cartMessage.textContent = message;

        cartMessage.className = error
            ? "cart-message is-error"
            : "cart-message";
    }

    // RESETAR ÁREAS DE PAGAMENTO
    async function destroyCardBrick() {
        if (cardPaymentBrickController) {
            try {
                await cardPaymentBrickController.unmount();
            } catch (error) {
                console.warn("Erro ao fechar formulário de cartão:", error);
            }

            cardPaymentBrickController = null;
        }

        if (cardPaymentBrickContainer) {
            cardPaymentBrickContainer.replaceChildren();
        }
    }

    async function resetPaymentPanels() {
        await destroyCardBrick();

        if (cardPaymentPanel) cardPaymentPanel.hidden = true;
        if (pixPaymentPanel) pixPaymentPanel.hidden = true;

        if (checkoutForm) checkoutForm.hidden = false;

        if (paymentSelector) paymentSelector.hidden = false;

        if (pixQrImage) pixQrImage.removeAttribute("src");
        if (pixCopyPaste) pixCopyPaste.value = "";
        if (pixTxid) pixTxid.textContent = "—";

        currentPixPayload = "";

        showCartMessage("");
    }

    // ATUALIZAR CARTÕES DE PRODUTOS
    function updateProductCards() {
        products.forEach(product => {
            const priceNode = $(
                `[data-price-for="${product.id}"]`
            );

            const stockNode = $(
                `[data-stock-for="${product.id}"]`
            );

            const card = $(
                `[data-product="${product.id}"]`
            );

            const button = $(
                `[data-open-product="${product.id}"]`,
                card || document
            );

            if (priceNode) {
                priceNode.textContent =
                    money.format(Number(product.price));
            }

            const units = totalStock(product);

            if (stockNode) {
                stockNode.textContent = units > 0
                    ? `${units} unidades disponíveis`
                    : "Indisponível no momento";
            }

            if (button && units <= 0) {
                button.textContent = "Em breve";
                button.disabled = true;
            }
        });
    }

    // RENDERIZAR CARRINHO
    function renderCart() {
        if (pixPaymentPanel && !pixPaymentPanel.hidden) {
            void resetPaymentPanels();
        }

        const validCart = cart.filter(item => {
            const product = products.get(item.id);

            return product &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) > 0;
        });

        if (validCart.length !== cart.length) {
            cart = validCart;
        }

        const count = cart.reduce(
            (sum, item) => sum + item.quantity,
            0
        );

        const subtotal = cart.reduce((sum, item) => {
            const product = products.get(item.id);

            return sum +
                (product
                    ? Number(product.price) * item.quantity
                    : 0);
        }, 0);

        if (cartCount) {
            cartCount.textContent = String(count);
        }

        if (cartSubtitle) {
            cartSubtitle.textContent =
                `${count} ${count === 1
                    ? "item selecionado"
                    : "itens selecionados"}`;
        }

        if (cartSubtotal) {
            cartSubtotal.textContent = money.format(subtotal);
        }

        if (cartEmpty) {
            cartEmpty.hidden = cart.length > 0;
        }

        if (cartCheckout) {
            cartCheckout.hidden = cart.length === 0;
        }

        if (!cartItems) return;

        cartItems.replaceChildren();

        cart.forEach(item => {
            const product = products.get(item.id);

            if (!product) return;

            const row = document.createElement("article");
            row.className = "cart-item";

            const image = document.createElement("img");
            image.src = product.image;
            image.alt = product.name;
            image.className = "cart-item-image";

            const details = document.createElement("div");
            details.className = "cart-item-details";

            const name = document.createElement("h3");
            name.textContent = product.name;

            const variant = document.createElement("p");
            variant.textContent = `Tamanho: ${item.size}`;

            const unit = document.createElement("p");
            unit.className = "cart-item-unit";
            unit.textContent =
                `${money.format(product.price)} / unidade`;

            const controls = document.createElement("div");
            controls.className = "cart-item-controls";

            const minus = document.createElement("button");
            minus.type = "button";
            minus.textContent = "−";
            minus.setAttribute(
                "aria-label",
                `Diminuir quantidade de ${product.name}`
            );

            const quantity = document.createElement("span");
            quantity.textContent = String(item.quantity);

            const plus = document.createElement("button");
            plus.type = "button";
            plus.textContent = "+";
            plus.setAttribute(
                "aria-label",
                `Aumentar quantidade de ${product.name}`
            );

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "cart-remove";
            remove.textContent = "Remover";

            minus.addEventListener("click", () => {
                changeCartQuantity(item.id, item.size, -1);
            });

            plus.addEventListener("click", () => {
                changeCartQuantity(item.id, item.size, 1);
            });

            remove.addEventListener("click", () => {
                cart = cart.filter(entry =>
                    !(entry.id === item.id && entry.size === item.size)
                );

                saveCart();
                renderCart();
            });

            controls.append(minus, quantity, plus, remove);

            details.append(name, variant, unit, controls);

            const total = document.createElement("strong");
            total.className = "cart-item-total";
            total.textContent = money.format(
                product.price * item.quantity
            );

            row.append(image, details, total);

            cartItems.append(row);
        });

        saveCart();
    }

    // ALTERAR QUANTIDADE DO CARRINHO
    function changeCartQuantity(id, size, delta) {
        const item = getCartItem(id, size);
        const product = products.get(id);

        if (!item || !product) return;

        const next = item.quantity + delta;
        const available = availableForSize(product, size);

        if (next <= 0) {
            cart = cart.filter(entry =>
                !(entry.id === id && entry.size === size)
            );
        } else if (next <= available) {
            item.quantity = next;
        } else {
            notify(
                `Limite disponível para o tamanho ${size}: ${available} unidades.`
            );
        }

        saveCart();
        renderCart();
    }

    // ABRIR PRODUTO
    function openProduct(id) {
        const product = products.get(id);

        if (!product || !productDialog) return;

        selectedProduct = product;
        selectedQuantity = 1;

        dialogImage.src = product.image;
        dialogImage.alt = product.name;

        dialogTitle.textContent = product.name;
        dialogCategory.textContent = product.category;
        dialogDescription.textContent = product.description;

        dialogPrice.textContent = money.format(product.price);

        sizeSelect.replaceChildren();

        product.sizes.forEach(size => {
            const option = document.createElement("option");
            option.value = size;

            const available = availableForSize(product, size);

            option.textContent = available > 0
                ? size
                : `${size} — esgotado`;

            option.disabled = available <= 0;

            sizeSelect.append(option);
        });

        const firstAvailableSize = product.sizes.find(size =>
            availableForSize(product, size) > 0
        );

        if (firstAvailableSize) {
            sizeSelect.value = firstAvailableSize;
        }

        const available = firstAvailableSize
            ? availableForSize(product, firstAvailableSize)
            : 0;

        dialogStock.textContent = available > 0
            ? `${available} unidades disponíveis neste tamanho`
            : "Produto indisponível no momento.";

        qtyOutput.textContent = "1";
        qtyMinus.disabled = true;
        qtyPlus.disabled = available <= 1;

        addToCartButton.disabled = available <= 0;

        addToCartButton.textContent = available > 0
            ? "Adicionar à sacola"
            : "Indisponível";

        if (typeof productDialog.showModal === "function") {
            productDialog.showModal();
        }
    }

    $$("[data-open-product]").forEach(button => {
        button.addEventListener("click", () => {
            openProduct(button.dataset.openProduct);
        });
    });

    // QUANTIDADE DO PRODUTO
    const refreshProductQuantity = () => {
        if (!selectedProduct) return;

        const available = availableForSize(
            selectedProduct,
            sizeSelect.value
        );

        selectedQuantity = Math.min(
            selectedQuantity,
            Math.max(available, 1)
        );

        qtyOutput.textContent = String(selectedQuantity);

        dialogStock.textContent = available > 0
            ? `${available} unidades disponíveis neste tamanho`
            : "Este tamanho está esgotado.";

        qtyMinus.disabled = selectedQuantity <= 1;
        qtyPlus.disabled = selectedQuantity >= available;

        addToCartButton.disabled = available <= 0;

        addToCartButton.textContent = available > 0
            ? "Adicionar à sacola"
            : "Indisponível";
    };

    sizeSelect?.addEventListener("change", () => {
        selectedQuantity = 1;
        refreshProductQuantity();
    });

    qtyMinus?.addEventListener("click", () => {
        if (!selectedProduct || selectedQuantity <= 1) return;

        selectedQuantity--;

        refreshProductQuantity();
    });

    qtyPlus?.addEventListener("click", () => {
        if (!selectedProduct) return;

        if (
            selectedQuantity >=
            availableForSize(selectedProduct, sizeSelect.value)
        ) {
            return;
        }

        selectedQuantity++;

        refreshProductQuantity();
    });

    // ADICIONAR AO CARRINHO
    addToCartButton?.addEventListener("click", () => {
        if (!selectedProduct) return;

        const size = sizeSelect.value;

        const existing = getCartItem(
            selectedProduct.id,
            size
        );

        const current = existing ? existing.quantity : 0;

        const available = availableForSize(
            selectedProduct,
            size
        );

        if (current + selectedQuantity > available) {
            notify(
                `Há apenas ${available - current} unidade(s) adicional(is) desse tamanho.`
            );
            return;
        }

        if (existing) {
            existing.quantity += selectedQuantity;
        } else {
            cart.push({
                id: selectedProduct.id,
                size,
                quantity: selectedQuantity
            });
        }

        saveCart();
        renderCart();

        productDialog.close();

        notify(
            `${selectedProduct.name} foi adicionada à sacola.`
        );
    });

    // MODAIS
    productDialogClose?.addEventListener("click", () => {
        productDialog.close();
    });

    productDialog?.addEventListener("click", event => {
        if (event.target === productDialog) {
            productDialog.close();
        }
    });

    cartOpen?.addEventListener("click", () => {
        cartDialog.showModal();
    });

    cartClose?.addEventListener("click", () => {
        cartDialog.close();
    });

    $("#continueShopping")?.addEventListener("click", () => {
        cartDialog.close();
    });

    cartDialog?.addEventListener("click", event => {
        if (event.target === cartDialog) {
            cartDialog.close();
        }
    });

    // FORMA DE PAGAMENTO SELECIONADA
    const selectedPaymentMethod = () => {
        return paymentInputs.find(input => input.checked)?.value ||
            "pix_direct";
    };

    function updatePaymentAction() {
        if (!checkoutButton) return;

        if (catalog.demoData === true) {
            checkoutButton.textContent = "Checkout em configuração";
            checkoutButton.disabled = true;
            return;
        }

        checkoutButton.disabled = false;

        const method = selectedPaymentMethod();

        if (method === "pix_direct") {
            checkoutButton.textContent = "Gerar QR Code Pix";
        } else if (method === "card") {
            checkoutButton.textContent = "Continuar para dados do cartão";
        } else {
            checkoutButton.textContent = "Continuar para Mercado Pago";
        }
    }

    // MUDANÇA DE PAGAMENTO
    paymentInputs.forEach(input => {
        input.addEventListener("change", async () => {
            await resetPaymentPanels();
            updatePaymentAction();
        });
    });

    // VALIDAR CPF
    function validateCPF(value) {
        const cpf = String(value || "").replace(/\D/g, "");

        if (cpf.length !== 11) return false;

        if (/^(\d)\1{10}$/.test(cpf)) return false;

        return true;
    }

    // VALIDAR COMPRADOR
    function validateBuyer() {
        const buyerName = buyerNameInput?.value.trim() || "";
        const buyerEmail = buyerEmailInput?.value.trim() || "";
        const buyerCpf = buyerCpfInput?.value.trim() || "";

        if (!buyerName) {
            showCartMessage("Informe seu nome completo.", true);
            buyerNameInput?.focus();
            return null;
        }

        if (!buyerEmail || !buyerEmailInput.checkValidity()) {
            showCartMessage("Informe um e-mail válido.", true);
            buyerEmailInput?.focus();
            return null;
        }

        if (!validateCPF(buyerCpf)) {
            showCartMessage(
                "Informe um CPF válido com 11 números.",
                true
            );

            buyerCpfInput?.focus();

            return null;
        }

        return {
            buyerName,
            buyerEmail,
            buyerCpf: buyerCpf.replace(/\D/g, "")
        };
    }

    // REQUISIÇÕES À API DA LOJA
    async function apiPost(endpoint, body) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Erro na comunicação com o servidor (${response.status}).`
            );
        }

        return data;
    }

    async function apiGet(endpoint) {
        const response = await fetch(endpoint, {
            method: "GET",
            cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Não foi possível acessar o servidor."
            );
        }

        return data;
    }

    // INICIALIZAR MERCADO PAGO
    async function initializeMercadoPago() {
        if (bricksBuilder) return;

        if (!window.MercadoPago) {
            throw new Error(
                "SDK do Mercado Pago não carregou. Verifique a conexão."
            );
        }

        const config = await apiGet("/api/config");

        if (!config.publicKey) {
            throw new Error(
                "A chave pública do Mercado Pago não foi configurada."
            );
        }

        mercadoPago = new window.MercadoPago(
            config.publicKey,
            {
                locale: "pt-BR"
            }
        );

        bricksBuilder = mercadoPago.bricks();
    }

    // BOTÃO DE VOLTAR DO CARTÃO
    function createCardBackButton() {
        if (cardBackButton) return cardBackButton;

        cardBackButton = document.createElement("button");

        cardBackButton.id = "cardBackToCheckout";
        cardBackButton.type = "button";
        cardBackButton.className = "pix-back-button";
        cardBackButton.textContent = "Voltar às formas de pagamento";

        cardBackButton.addEventListener("click", async () => {
            await resetPaymentPanels();
        });

        cardPaymentPanel.append(cardBackButton);

        return cardBackButton;
    }

    // EXIBIR FORMULÁRIO SEGURO DE CARTÃO
    async function showCardPayment(buyer) {
        const items = getCartItemsForPayment();

        if (!items.length) {
            throw new Error("Seu carrinho está vazio.");
        }

        const quote = await apiPost(
            "/api/checkout/quote",
            { items }
        );

        const amount = Number(quote.totalAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("O valor do pedido é inválido.");
        }

        await initializeMercadoPago();

        await destroyCardBrick();

        pixPaymentPanel.hidden = true;
        checkoutForm.hidden = true;
        paymentSelector.hidden = true;
        cardPaymentPanel.hidden = false;

        createCardBackButton();

        showCartMessage(
            "Preencha os dados do cartão no formulário seguro do Mercado Pago."
        );

        cardPaymentBrickController = await bricksBuilder.create(
            "cardPayment",
            "cardPaymentBrickContainer",
            {
                initialization: {
                    amount,
                    payer: {
                        email: buyer.buyerEmail,
                        identification: {
                            type: "CPF",
                            number: buyer.buyerCpf
                        }
                    }
                },

                callbacks: {
                    onReady: () => {
                        showCartMessage(
                            `Formulário pronto. Total: ${money.format(amount)}.`
                        );
                    },

                    onSubmit: async formData => {
                        try {
                            const result = await apiPost(
                                "/api/card-payment",
                                {
                                    items,
                                    buyer,
                                    formData
                                }
                            );

                            const status = result.status;

                            if (status === "approved") {
                                showCartMessage(
                                    `Pagamento aprovado! Número da transação: ${result.id}.`
                                );

                                notify("Pagamento aprovado pelo Mercado Pago.");
                            } else if (
                                status === "pending" ||
                                status === "in_process" ||
                                status === "authorized"
                            ) {
                                showCartMessage(
                                    `Pagamento em análise. Status: ${status}.`
                                );

                                notify("Pagamento recebido para análise.");
                            } else {
                                throw new Error(
                                    result.statusDetail ||
                                    `Pagamento não aprovado. Status: ${status}.`
                                );
                            }

                            return result;

                        } catch (error) {
                            showCartMessage(error.message, true);
                            throw error;
                        }
                    },

                    onError: error => {
                        console.error(
                            "Erro no formulário de cartão:",
                            error
                        );

                        showCartMessage(
                            "Ocorreu um erro no formulário de cartão. Confira os dados e tente novamente.",
                            true
                        );
                    }
                }
            }
        );
    }

    // GERAR PIX REAL PELO MERCADO PAGO
    async function generatePix(buyer) {
        const items = getCartItemsForPayment();

        if (!items.length) {
            throw new Error("Seu carrinho está vazio.");
        }

        const result = await apiPost(
            "/api/create-pix",
            {
                ...buyer,
                items
            }
        );

        if (
            !result.pixCopyPaste ||
            !result.qrCodeDataUrl ||
            !result.totalAmount
        ) {
            throw new Error(
                "O Mercado Pago não retornou os dados completos do Pix."
            );
        }

        currentPixPayload = result.pixCopyPaste;

        pixQrImage.src = result.qrCodeDataUrl;

        pixTotal.textContent = money.format(
            Number(result.totalAmount)
        );

        pixKeyDisplay.textContent =
            result.pixKeyDisplay || "Mercado Pago";

        const recipientLabel = pixKeyDisplay
            .closest(".pix-recipient-row")
            ?.querySelector("span");

        if (recipientLabel) {
            recipientLabel.textContent = "Recebedor";
        }

        pixTxid.textContent = result.txid || result.paymentId || "—";

        pixCopyPaste.value = currentPixPayload;

        cardPaymentPanel.hidden = true;
        paymentSelector.hidden = true;
        checkoutForm.hidden = true;
        pixPaymentPanel.hidden = false;

        showCartMessage(
            "QR Code gerado. Confira o valor e o recebedor no aplicativo do seu banco antes de confirmar."
        );

        notify("QR Code Pix gerado com sucesso.");
    }

    // CHECKOUT PRO
    async function startMercadoPagoCheckout(buyer) {
        const items = getCartItemsForPayment();

        if (!items.length) {
            throw new Error("Seu carrinho está vazio.");
        }

        const result = await apiPost(
            "/api/create-order",
            {
                ...buyer,
                items
            }
        );

        if (!result.checkoutUrl) {
            throw new Error(
                "O Mercado Pago não retornou o endereço de pagamento."
            );
        }

        const checkoutURL = new URL(result.checkoutUrl);

        const validDomain =
            checkoutURL.protocol === "https:" &&
            (
                checkoutURL.hostname === "mercadopago.com.br" ||
                checkoutURL.hostname.endsWith(".mercadopago.com.br") ||
                checkoutURL.hostname === "mercadopago.com" ||
                checkoutURL.hostname.endsWith(".mercadopago.com")
            );

        if (!validDomain) {
            throw new Error(
                "O endereço de pagamento retornado não é válido."
            );
        }

        localStorage.setItem(
            "astra-store-last-order",
            result.orderId || ""
        );

        window.location.assign(checkoutURL.href);
    }

    // FINALIZAR PEDIDO
    checkoutForm?.addEventListener("submit", async event => {
        event.preventDefault();

        if (!cart.length) {
            showCartMessage("Seu carrinho está vazio.", true);
            return;
        }

        if (catalog.demoData === true) {
            showCartMessage(
                "O catálogo está em modo de demonstração. Configure preços e estoque reais antes de ativar os pagamentos.",
                true
            );
            return;
        }

        if (!checkoutForm.reportValidity()) return;

        const buyer = validateBuyer();

        if (!buyer) return;

        const paymentMethod = selectedPaymentMethod();

        const originalLabel = checkoutButton.textContent;

        checkoutButton.disabled = true;

        checkoutButton.textContent = paymentMethod === "pix_direct"
            ? "Gerando Pix..."
            : paymentMethod === "card"
                ? "Carregando cartão..."
                : "Preparando checkout...";

        showCartMessage(
            "Preparando seu pagamento com segurança..."
        );

        try {
            if (paymentMethod === "pix_direct") {
                await generatePix(buyer);
            }

            if (paymentMethod === "card") {
                await showCardPayment(buyer);
            }

            if (paymentMethod === "mercadopago") {
                await startMercadoPagoCheckout(buyer);
            }

        } catch (error) {
            console.error("Erro no checkout:", error);

            showCartMessage(error.message, true);

            if (cardPaymentPanel) {
                cardPaymentPanel.hidden = true;
            }

            checkoutForm.hidden = false;
            paymentSelector.hidden = false;

        } finally {
            checkoutButton.disabled = false;

            checkoutButton.textContent = originalLabel;

            updatePaymentAction();
        }
    });

    // COPIAR PIX
    copyPixCodeButton?.addEventListener("click", async () => {
        if (!currentPixPayload) return;

        try {
            await navigator.clipboard.writeText(currentPixPayload);

            notify("Código Pix copiado.");

        } catch {
            pixCopyPaste.focus();
            pixCopyPaste.select();

            const copied = document.execCommand("copy");

            notify(
                copied
                    ? "Código Pix copiado."
                    : "Selecione e copie o código Pix."
            );
        }
    });

    // VOLTAR DO PIX
    backToCheckoutButton?.addEventListener("click", async () => {
        await resetPaymentPanels();
    });

    // ATUALIZAR CATÁLOGO E CARRINHO
    updateProductCards();
    renderCart();
    updatePaymentAction();

    // LISTA DE CONTATO
    const waitlistForm = $("#waitlistForm");
    const formMessage = $("#formMessage");

    const nameInput = $("#nome");
    const emailInput = $("#email");

    const setFieldError = (field, message) => {
        field?.setAttribute("aria-invalid", "true");

        if (formMessage) {
            formMessage.textContent = message;
            formMessage.className = "form-message is-error";
        }

        field?.focus();
    };

    [nameInput, emailInput].forEach(field => {
        field?.addEventListener("input", () => {
            field.removeAttribute("aria-invalid");
        });
    });

    waitlistForm?.addEventListener("submit", event => {
        event.preventDefault();

        const name = nameInput?.value.trim() || "";
        const email = emailInput?.value.trim() || "";

        if (!name) {
            return setFieldError(
                nameInput,
                "Digite seu nome para continuar."
            );
        }

        if (!email || !emailInput.checkValidity()) {
            return setFieldError(
                emailInput,
                "Digite um endereço de e-mail válido."
            );
        }

        formMessage.textContent =
            `Obrigado, ${name}. Este formulário é demonstrativo e não enviou seus dados.`;

        formMessage.className = "form-message is-success";
    });

    // RETORNO DO MERCADO PAGO
    const checkoutReturn = new URLSearchParams(
        window.location.search
    ).get("checkout");

    if (checkoutReturn) {
        const messages = {
            approved:
                "O checkout informou pagamento aprovado. Confirme a transação na sua conta Mercado Pago antes de liberar o pedido.",

            pending:
                "O pagamento está pendente. Aguarde a confirmação no Mercado Pago.",

            failure:
                "O pagamento não foi concluído. Você pode tentar novamente."
        };

        notify(
            messages[checkoutReturn] ||
            "Você retornou do checkout do Mercado Pago."
        );

        history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.hash
        );
    }

    // CAMPO CPF
    buyerCpfInput?.addEventListener("input", () => {
        let value = buyerCpfInput.value.replace(/\D/g, "").slice(0, 11);

        if (value.length > 9) {
            value = value.replace(
                /^(\d{3})(\d{3})(\d{3})(\d{0,2})$/,
                "$1.$2.$3-$4"
            );
        } else if (value.length > 6) {
            value = value.replace(
                /^(\d{3})(\d{3})(\d{0,3})$/,
                "$1.$2.$3"
            );
        } else if (value.length > 3) {
            value = value.replace(
                /^(\d{3})(\d{0,3})$/,
                "$1.$2"
            );
        }

        buyerCpfInput.value = value;
    });

    // FUNDO ANIMADO DE ESTRELAS
    const canvas = $("#starfield");
    const context = canvas?.getContext("2d");

    if (canvas && context && !reducedMotion) {
        let width = 0;
        let height = 0;
        let stars = [];
        let animationFrame = 0;

        let pointer = {
            x: -1000,
            y: -1000
        };

        const createStars = () => {
            const density = Math.min(
                180,
                Math.floor((width * height) / 8500)
            );

            stars = Array.from(
                { length: density },
                () => ({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 1.25 + 0.25,
                    alpha: Math.random() * 0.55 + 0.15,
                    phase: Math.random() * Math.PI * 2,
                    speed: Math.random() * 0.008 + 0.002
                })
            );
        };

        const resizeCanvas = () => {
            const ratio = Math.min(
                window.devicePixelRatio || 1,
                1.6
            );

            width = window.innerWidth;
            height = window.innerHeight;

            canvas.width = Math.floor(width * ratio);
            canvas.height = Math.floor(height * ratio);

            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            context.setTransform(
                ratio,
                0,
                0,
                ratio,
                0,
                0
            );

            createStars();
        };

        const drawStars = () => {
            context.clearRect(0, 0, width, height);

            stars.forEach(star => {
                star.phase += star.speed;

                const pulse =
                    0.55 + Math.sin(star.phase) * 0.35;

                const dx = pointer.x - star.x;
                const dy = pointer.y - star.y;

                const distance = Math.sqrt(
                    dx * dx + dy * dy
                );

                const influence = distance < 150
                    ? (1 - distance / 150) * 0.16
                    : 0;

                const alpha = Math.min(
                    0.95,
                    star.alpha * pulse + influence
                );

                context.beginPath();

                context.arc(
                    star.x,
                    star.y,
                    star.radius,
                    0,
                    Math.PI * 2
                );

                context.fillStyle =
                    `rgba(205, 221, 255, ${alpha})`;

                context.fill();
            });

            animationFrame =
                window.requestAnimationFrame(drawStars);
        };

        window.addEventListener(
            "resize",
            resizeCanvas,
            { passive: true }
        );

        window.addEventListener(
            "pointermove",
            event => {
                pointer = {
                    x: event.clientX,
                    y: event.clientY
                };
            },
            { passive: true }
        );

        window.addEventListener("pointerleave", () => {
            pointer = {
                x: -1000,
                y: -1000
            };
        });

        resizeCanvas();
        drawStars();

        window.addEventListener(
            "pagehide",
            () => {
                window.cancelAnimationFrame(animationFrame);
            },
            { once: true }
        );
    }
});