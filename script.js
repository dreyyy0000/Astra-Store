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
    const demoPaymentWarning = $("#demoPaymentWarning");
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

    if (demoPaymentWarning) {
        demoPaymentWarning.hidden = false;
        demoPaymentWarning.textContent = catalog.demoData === true
            ? "Catálogo com preços de demonstração. Esta versão registra pedidos, mas não processa cobranças; nenhum cartão será cobrado."
            : "Esta versão registra pedidos, mas não processa cobranças; nenhum cartão será cobrado.";
    }

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

    const buyerNameInput = $("#buyerName");
    const buyerEmailInput = $("#buyerEmail");
    const buyerCpfInput = $("#buyerCpf");
    const cardPaymentPanel = $("#cardPaymentPanel");
    const cardInfoForm = $("#cardInfoForm");
    const orderSuccessPanel = $("#orderSuccessPanel");
    const finishSuccessButton = $("#finishSuccessButton");
    let currentOrderReference = "";

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

        const successVisible = Boolean(orderSuccessPanel && !orderSuccessPanel.hidden);
        if (cartEmpty) {
            cartEmpty.hidden = cart.length > 0 || successVisible;
        }

        if (cartCheckout) {
            cartCheckout.hidden = cart.length === 0 && !successVisible;
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

    // CHECKOUT EM DUAS ETAPAS: REGISTRO DO PEDIDO E CONFIRMAÇÃO DE METADADOS
    function updatePaymentAction() {
        if (!checkoutButton) return;
        checkoutButton.textContent = "Continuar para dados do cartão";
    }

    function validateCPF(value) {
        const cpf = String(value || "").replace(/\D/g, "");
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        let sum = 0;
        for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
        let digit = (sum * 10) % 11;
        if (digit === 10) digit = 0;
        if (digit !== Number(cpf[9])) return false;
        sum = 0;
        for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
        digit = (sum * 10) % 11;
        if (digit === 10) digit = 0;
        return digit === Number(cpf[10]);
    }

    function validateBuyer() {
        const buyer = {
            buyerName: buyerNameInput?.value.trim() || "",
            buyerEmail: buyerEmailInput?.value.trim() || "",
            buyerPhone: $("#buyerPhone")?.value.trim() || "",
            buyerCpf: buyerCpfInput?.value.trim() || "",
            postalCode: $("#postalCode")?.value.trim() || "",
            street: $("#street")?.value.trim() || "",
            addressNumber: $("#addressNumber")?.value.trim() || "",
            complement: $("#complement")?.value.trim() || "",
            neighborhood: $("#neighborhood")?.value.trim() || "",
            city: $("#city")?.value.trim() || "",
            state: $("#state")?.value.trim().toUpperCase() || ""
        };

        if (!validateCPF(buyer.buyerCpf)) {
            showCartMessage("Informe um CPF válido com 11 números.", true);
            buyerCpfInput?.focus();
            return null;
        }
        if (buyer.postalCode.replace(/\D/g, "").length !== 8) {
            showCartMessage("Informe um CEP válido com 8 números.", true);
            $("#postalCode")?.focus();
            return null;
        }
        if (!/^[A-Z]{2}$/.test(buyer.state)) {
            showCartMessage("Informe a UF com duas letras, por exemplo SP.", true);
            $("#state")?.focus();
            return null;
        }
        return buyer;
    }

    async function apiPost(endpoint, body) {
        let response;
        try {
            response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                cache: "no-store",
                body: JSON.stringify(body)
            });
        } catch (error) {
            throw new Error("Não foi possível alcançar o servidor da loja. Inicie pelo arquivo iniciar-loja.bat (Windows) ou execute npm run dev dentro da pasta do projeto.");
        }

        if (response.status === 405) {
            throw new Error("Erro 405: o checkout está sendo aberto por um servidor que não executa a API. Feche o Live Server e inicie a loja com iniciar-loja.bat (Windows) ou npm run dev. Acesse http://localhost:3000.");
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            if (response.status === 404) {
                throw new Error("A rota do checkout não existe neste servidor. Inicie o projeto pelo Node.js com iniciar-loja.bat ou npm run dev e acesse http://localhost:3000.");
            }
            throw new Error(`O servidor respondeu de forma inesperada (${response.status}). Inicie a loja pelo servidor Node.js.`);
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || `Erro na comunicação com o servidor (${response.status}).`);
        }
        return data;
    }

    checkoutForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!cart.length) {
            showCartMessage("Sua sacola está vazia.", true);
            return;
        }
        if (!checkoutForm.reportValidity()) return;
        const buyer = validateBuyer();
        if (!buyer) return;

        const originalLabel = checkoutButton.textContent;
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Registrando seus dados...";
        showCartMessage("Salvando comprador, endereço e itens do pedido no banco de dados...");

        try {
            const result = await apiPost("/api/checkout/start", {
                buyer,
                items: getCartItemsForPayment()
            });
            currentOrderReference = result.orderReference;
            checkoutForm.hidden = true;
            if (paymentSelector) paymentSelector.hidden = true;
            if (cardPaymentPanel) cardPaymentPanel.hidden = false;
            if (orderSuccessPanel) orderSuccessPanel.hidden = true;
            showCartMessage(`Pedido ${currentOrderReference} registrado. Preencha os dados não sensíveis do cartão para concluir o registro.`);
        } catch (error) {
            console.error("Erro ao registrar o pedido:", error);
            showCartMessage(error.message || "Não foi possível registrar o pedido.", true);
        } finally {
            checkoutButton.disabled = false;
            checkoutButton.textContent = originalLabel;
        }
    });

    // Apenas bandeira, quatro últimos dígitos e parcelas são enviados ao servidor.
    cardInfoForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!currentOrderReference) {
            showCartMessage("Não encontrei o pedido em andamento. Volte à sacola e tente novamente.", true);
            return;
        }
        if (!cardInfoForm.reportValidity()) return;

        const cardType = $("#cardType").value;
        const installments = cardType === "debit" ? 1 : Number($("#cardInstallments").value);
        const cardInfo = {
            cardholderName: $("#cardholderName").value.trim(),
            cardType,
            brand: $("#cardBrand").value,
            lastFour: $("#cardLastFour").value.replace(/\D/g, ""),
            installments
        };
        const completeButton = $("#completeOrderButton");
        const originalLabel = completeButton.textContent;
        completeButton.disabled = true;
        completeButton.textContent = "Finalizando pedido...";
        showCartMessage("Salvando a confirmação do pedido...");

        try {
            const result = await apiPost("/api/checkout/complete", {
                orderReference: currentOrderReference,
                cardInfo
            });
            $("#successOrderReference").textContent = result.orderReference;
            $("#successOrderTotal").textContent = money.format(Number(result.totalAmount));
            if (cardPaymentPanel) cardPaymentPanel.hidden = true;
            if (orderSuccessPanel) orderSuccessPanel.hidden = false;
            if (checkoutForm) checkoutForm.hidden = true;
            if (paymentSelector) paymentSelector.hidden = true;
            showCartMessage("");
            cart = [];
            saveCart();
            renderCart();
            currentOrderReference = "";
            cardInfoForm.reset();
            const installmentsField = $("#cardInstallments");
            if (installmentsField) installmentsField.disabled = false;
            notify("Pedido registrado com sucesso!");
        } catch (error) {
            console.error("Erro ao finalizar o pedido:", error);
            showCartMessage(error.message || "Não foi possível finalizar o pedido.", true);
        } finally {
            completeButton.disabled = false;
            completeButton.textContent = originalLabel;
        }
    });

    finishSuccessButton?.addEventListener("click", () => {
        if (cartDialog?.open) cartDialog.close();
        if (orderSuccessPanel) orderSuccessPanel.hidden = true;
        if (checkoutForm) checkoutForm.hidden = false;
        if (paymentSelector) paymentSelector.hidden = false;
        checkoutForm?.reset();
        renderCart();
        showCartMessage("");
    });

    $("#cardType")?.addEventListener("change", event => {
        const installments = $("#cardInstallments");
        if (!installments) return;
        const debit = event.target.value === "debit";
        installments.disabled = debit;
        if (debit) installments.value = "1";
        else installments.disabled = false;
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


    // Máscaras simples dos dados de entrega.
    $("#postalCode")?.addEventListener("input", event => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
        event.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    });
    $("#buyerPhone")?.addEventListener("input", event => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
        if (digits.length <= 2) event.target.value = digits ? `(${digits}` : "";
        else if (digits.length <= 7) event.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        else event.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    });
    $("#state")?.addEventListener("input", event => {
        event.target.value = event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
    });
    $("#cardLastFour")?.addEventListener("input", event => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
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