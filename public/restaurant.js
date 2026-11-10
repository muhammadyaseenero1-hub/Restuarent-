(() => {
    'use strict';
    const API_URL = 'https://script.google.com/macros/s/AKfycbycXJNPc7LOe_OBBxpNrthnG5HqrhP9uJBNl5PrTfLC9zgcWb-aqxWlLDHJFQ6DyofIRA/exec';
    const CART_KEY = 'savor_bistro_cart';
    const SAMPLE_MENU = [
      ['P001','Chicken Burger','Burgers',150,12,'Crispy chicken breast, garlic aioli and fresh lettuce.','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80'],
      ['P002','Cheese Burger','Burgers',180,8,'Flame-grilled patty with melted cheddar cheese.','https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80'],
      ['P003','Double Beef Burger','Burgers',220,5,'Double beef patties, aged cheddar and caramelized onions.','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80'],
      ['P004','Beef Burger','Burgers',200,7,'Juicy beef patty with fresh vegetables and house sauce.','https://images.unsplash.com/photo-1553979459-d2229ba7433a?auto=format&fit=crop&w=700&q=80'],
      ['P005','Margherita Pizza','Pizza',250,10,'Stone-baked crust, tomato sauce, mozzarella and basil.','https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80'],
      ['P006','Chicken Pizza','Pizza',320,6,'Chicken, mozzarella, peppers and caramelized onions.','https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=700&q=80'],
      ['P007','Cheese Burst Pizza','Pizza',350,4,'Loaded with rich melted cheese and a crispy crust.','https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80'],
      ['P008','Chicken Biriyani','Biriyani',180,15,'Aromatic basmati rice with slow-cooked chicken and spices.','https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=700&q=80'],
      ['P009','Beef Biriyani','Biriyani',220,9,'Flavourful beef biriyani with authentic spices.','https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=700&q=80'],
      ['P010','Egg Biriyani','Biriyani',140,12,'Fragrant basmati rice served with boiled eggs.','https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=700&q=80'],
      ['P011','Chicken Fried Rice','Fried Rice',160,14,'Wok-tossed rice with chicken and fresh vegetables.','https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80'],
      ['P012','Veg Fried Rice','Fried Rice',120,20,'Fried rice with fresh vegetables and aromatic seasoning.','https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80'],
      ['P013','Schezwan Fried Rice','Fried Rice',190,8,'Spicy Schezwan rice with vegetables and special sauce.','https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80']
    ].map(([id,name,category,price,stock,description,image]) => ({id,name,category,price,stock,description,image}));
    const categoryPhotos = {
      Burgers:'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80',
      Pizza:'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80',
      Biriyani:'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=700&q=80',
      'Fried Rice':'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80'
    };
    let products = [];
    let liveProductsLoaded = false;
    let cart = readCart();
    let currentFilter = 'All';
    let query = '';
    let coupon = '';
    let busy = false;
    let refreshingMenu = false;
    let refreshPromise = null;
    const $ = id => document.getElementById(id);
    const safeNumber = value => {
      if(typeof value==='number')return Number.isFinite(value)?value:0;
      if(value==null)return 0;
      const parsed=Number(String(value).replace(/[^0-9.+-]/g,''));
      return Number.isFinite(parsed)?parsed:0;
    };
    function readMenuField(row,aliases){
      const fields=Object.entries(row||{});
      const normalize=key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,'');
      for(const alias of aliases){const wanted=normalize(alias);const found=fields.find(([key])=>normalize(key)===wanted);if(found)return found[1]}
      for(const alias of aliases){const wanted=normalize(alias);const found=fields.find(([key])=>normalize(key).startsWith(wanted)||normalize(key).endsWith(wanted));if(found)return found[1]}
      return undefined;
    }
    function readCart(){try{const raw=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(raw)?raw.filter(x=>x&&x.id&&Number(x.quantity)>0):[]}catch{return []}}
    function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{};updateCart();renderCart()}
    function money(value){return '₹'+Math.max(0,Math.round(safeNumber(value))).toLocaleString('en-IN')}
    function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function showToast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.add('hidden'),2400)}
    function normalizeProducts(payload){
      // Apps Script returns objects using the exact Google Sheet headers,
      // for example "Item ID" and "Item Name". Support those names as well
      // as camelCase keys used by other API versions.
      let list=Array.isArray(payload)?payload:null;
      if(!list&&payload&&typeof payload==='object'){
        for(const key of ['products','data','items','result']){
          if(Array.isArray(payload[key])){list=payload[key];break;}
        }
      }
      if(!list)throw new Error('The products response was not a list.');
      return list.map((p,i)=>({
        id:String(p['Item ID']??p.itemId??p.id??p.ID??'').trim(),
        name:String(p['Item Name']??p.itemName??p.name??p.productName??'').trim(),
        category:String(p['Category']??p.category??'Other').trim(),
        price:safeNumber(readMenuField(p,['Price','Item Price','Unit Price','Selling Price','Rate','Amount'])),
        stock:Math.max(0,safeNumber(p['Stock']??p.stock??p.quantity??0)),
        image:String(p['Image URL']??p['Image']??p.image??p.imageUrl??p.imageURL??p.image_url??p.imageLink??p.photoUrl??p.photo??'').trim(),
        description:String(p['Description']??p.description??p.details??''),
        _key:i
      })).filter(p=>p.id&&p.name&&Number.isFinite(p.price)&&p.price>=0);
    }
    function reconcileCart(live){
      const before=cart;const changes=[];const updated=[];
      for(const item of before){
        const product=live.find(p=>p.id===item.id);
        if(!product){changes.push(`${item.name} is no longer on the menu and was removed.`);continue}
        if(product.stock<=0){changes.push(`${product.name} is sold out and was removed.`);continue}
        const quantity=Math.min(safeNumber(item.quantity),product.stock);
        if(product.price!==safeNumber(item.price))changes.push(`${product.name} price changed from ${money(item.price)} to ${money(product.price)}.`);
        if(quantity<safeNumber(item.quantity))changes.push(`${product.name} quantity was reduced to ${quantity} (now in stock).`);
        updated.push({...product,quantity});
      }
      cart=updated;
      try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}
      return changes;
    }
    async function refreshProducts({initial=false}={}){
      if(refreshPromise)return refreshPromise;
      refreshPromise=(async()=>{
      const notice=$('api-notice');if(initial){notice.classList.add('hidden');$('menu-grid').innerHTML='<div class="loading"><span class="spinner"></span>Loading today\'s menu…</div>'}
      refreshingMenu=true;updateCart();
      const controller=new AbortController();const requestTimeout=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch(API_URL+'?action=products',{method:'GET',headers:{'Accept':'application/json'},cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Menu request failed ('+response.status+').');
        const payload=await response.json();const loaded=normalizeProducts(payload);
        if(!loaded.length)throw new Error('No products were returned.');
        products=loaded;liveProductsLoaded=true;
        const changes=reconcileCart(products);
        $('cart-sync-notice').className=changes.length?'notice':'notice hidden';
        if(changes.length)$('cart-sync-notice').innerHTML='<span class="icon">sync</span><span><strong>Menu updated. Review your cart:</strong><br>'+changes.map(escapeHTML).join('<br>')+'<br>Press Place Order again to continue.</span>';
        notice.classList.add('hidden');
        return changes;
      }catch(error){liveProductsLoaded=false;if(initial)products=SAMPLE_MENU.map((p,i)=>({...p,_key:i}));const failure=error.name==='AbortError'?'The live menu request timed out. Check your connection and retry.':'The live menu could not be reached. Check your connection and retry.';notice.className='notice error';notice.innerHTML='<span class="icon">cloud_off</span><span>'+failure+' '+(initial?'Showing sample dishes; ':'')+'Your cart is saved and checkout is paused until the live menu reconnects.</span><button type="button" id="retry-products" class="btn" style="margin-left:auto;padding:6px 10px;background:white;color:var(--primary);font-size:10px">Retry</button>';notice.classList.remove('hidden');$('retry-products').addEventListener('click',()=>refreshProducts());if(!initial){const syncNotice=$('cart-sync-notice');syncNotice.className='notice error';syncNotice.innerHTML='<span class="icon">cloud_off</span><span>'+failure+' Your cart is saved; retry before ordering.</span><button type="button" id="retry-cart-menu" class="btn" style="margin-left:auto;padding:6px 10px;background:white;color:var(--primary);font-size:10px">Retry</button>';syncNotice.querySelector('#retry-cart-menu').addEventListener('click',()=>refreshProducts())}return null}
      finally{clearTimeout(requestTimeout);refreshingMenu=false;refreshPromise=null;renderCategories();renderFilters();renderMenu();updateCart();renderCart()}
      })();return refreshPromise;
    }
    function renderCategories(){const cats=[...new Set(products.map(p=>p.category))];$('category-cards').innerHTML=cats.map(cat=>`<button class="category-card" type="button" data-category="${escapeHTML(cat)}"><img src="${escapeHTML(categoryPhotos[cat]||products.find(p=>p.category===cat)?.image||'')}" alt=""><span>${escapeHTML(cat)}</span></button>`).join('');$('category-cards').querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>selectCategory(btn.dataset.category,true)))}
    function renderFilters(){const cats=['All',...new Set(products.map(p=>p.category))];$('category-filters').innerHTML=cats.map(cat=>`<button type="button" class="filter ${cat===currentFilter?'active':''}" data-filter="${escapeHTML(cat)}">${escapeHTML(cat)}${cat==='All'?' Items':''}</button>`).join('');$('category-filters').querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>selectCategory(btn.dataset.filter,false)))}
    function selectCategory(category,scroll){currentFilter=category;renderFilters();renderMenu();if(scroll)$('complete-menu').scrollIntoView({behavior:'smooth',block:'start'})}
    function fallbackDishImage(product){const name=String(product?.name||'').toLowerCase();if(name.includes('burger'))return categoryPhotos.Burgers;if(name.includes('beef')&&(name.includes('biriyani')||name.includes('biryani')))return 'https://images.deliveryhero.io/image/talabat/MenuItems/kg_Beef_Biryani638907838119984864.jpg';if(name.includes('chicken')&&(name.includes('biriyani')||name.includes('biryani')))return SAMPLE_MENU.find(item=>item.name==='Egg Biriyani')?.image||categoryPhotos.Biriyani;if(name.includes('biriyani')||name.includes('biryani'))return categoryPhotos.Biriyani;return categoryPhotos[product?.category]||''}
    function renderMenu(){
      const q=query.toLowerCase();const filtered=products.filter(p=>(currentFilter==='All'||p.category===currentFilter)&&(!q||[p.name,p.category,p.description].join(' ').toLowerCase().includes(q)));
      $('menu-count').textContent=`${filtered.length} ${filtered.length===1?'Dish':'Dishes'}`;
      if(!filtered.length){$('menu-grid').innerHTML='<div class="empty-menu"><span class="icon">search_off</span><h3>No dishes found</h3><p>Try a different search or category.</p></div>';return}
      $('menu-grid').innerHTML=filtered.map(p=>{
        const item=cart.find(c=>c.id===p.id);const qty=item?.quantity||0;const out=p.stock<=0;const low=p.stock>0&&p.stock<=5;const fallbackImage=fallbackDishImage(p);const dishImage=p.image||fallbackImage;
        const action=qty?`<div class="stepper"><button type="button" data-cart-action="minus" data-id="${escapeHTML(p.id)}" aria-label="Decrease ${escapeHTML(p.name)}"><span class="icon">${qty===1?'delete':'remove'}</span></button><strong>${qty}</strong><button type="button" data-cart-action="plus" data-id="${escapeHTML(p.id)}" aria-label="Increase ${escapeHTML(p.name)}" ${qty>=p.stock?'disabled':''}><span class="icon">add</span></button></div>`:`<button type="button" class="btn btn-primary" data-cart-action="add" data-id="${escapeHTML(p.id)}" ${out?'disabled':''}><span class="icon">add_shopping_cart</span>${out?'Sold out':'Add to cart'}</button>`;
        return `<article class="dish"><div class="dish-image">${dishImage?`<img loading="lazy" src="${escapeHTML(dishImage)}" data-fallback="${escapeHTML(fallbackImage)}" alt="${escapeHTML(p.name)}">`:''}<span class="dish-category">${escapeHTML(p.category)}</span><span class="stock-tag ${out?'out':low?'low':''}">${out?'Sold out':`${p.stock} left`}</span></div><div class="dish-info"><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||`Freshly prepared ${p.name.toLowerCase()} made with quality ingredients.`)}</p><div class="dish-bottom"><span class="price">${money(p.price)}</span></div></div><div class="dish-action">${action}</div></article>`
      }).join('');
      $('menu-grid').querySelectorAll('.dish-image img').forEach(img=>img.addEventListener('error',()=>{const fallback=img.dataset.fallback;if(fallback&&img.getAttribute('src')!==fallback){img.src=fallback;return}img.remove()}));
      $('menu-grid').querySelectorAll('[data-cart-action]').forEach(btn=>btn.addEventListener('click',()=>changeQuantity(btn.dataset.id,btn.dataset.cartAction==='minus'?-1:1)));
    }
    function changeQuantity(id,delta){const p=products.find(x=>x.id===id);if(!p)return;if(delta>0&&p.stock<=0){showToast('That dish is sold out.');return}let item=cart.find(x=>x.id===id);if(!item&&delta>0){cart.push({...p,quantity:1});showToast(`${p.name} added to cart`)}else if(item){if(delta>0&&item.quantity>=p.stock){showToast(`Only ${p.stock} available`);return}item.quantity+=delta;if(item.quantity<=0){cart=cart.filter(x=>x.id!==id)}}saveCart();renderMenu()}
    function totals(){const subtotal=cart.reduce((s,x)=>s+safeNumber(x.price)*safeNumber(x.quantity),0);const tax=Math.round(subtotal*.05);const discount=coupon==='SAVOR20'&&subtotal>300?50:coupon==='FEAST10'&&subtotal>300?100:0;return{subtotal,tax,discount,total:Math.max(0,subtotal+tax-discount)}}
    function updateCart(){const qty=cart.reduce((s,x)=>s+safeNumber(x.quantity),0);$('cart-badge').textContent=qty;$('nav-total').textContent=money(cart.reduce((s,x)=>s+safeNumber(x.price)*safeNumber(x.quantity),0));const t=totals();$('subtotal').textContent=money(t.subtotal);$('tax').textContent=money(t.tax);$('discount').textContent='−'+money(t.discount);$('discount-row').classList.toggle('hidden',!t.discount);$('grand-total').textContent=money(t.total);$('order-button-text').textContent=refreshingMenu?'Checking live menu…':`Place Order · ${money(t.total)}`;$('place-order').disabled=busy||refreshingMenu||!liveProductsLoaded||qty===0;$('place-order').title=!liveProductsLoaded?'Checkout requires the live menu':''}
    function renderCart(){const count=cart.reduce((s,x)=>s+safeNumber(x.quantity),0);$('items-count').textContent=`${count} ${count===1?'item':'items'}`;$('cart-empty').classList.toggle('hidden',cart.length>0);$('cart-layout').classList.toggle('hidden',cart.length===0);$('cart-items').innerHTML=cart.map(item=>`<div class="cart-item"><img src="${escapeHTML(item.image||fallbackDishImage(item))}" alt="${escapeHTML(item.name)}"><div><div class="cart-name">${escapeHTML(item.name)}</div><div class="cart-meta">${escapeHTML(item.category||'Menu')} · ${money(item.price)} each</div></div><div class="stepper compact"><button type="button" data-id="${escapeHTML(item.id)}" data-delta="-1" aria-label="Decrease quantity"><span class="icon">${item.quantity===1?'delete':'remove'}</span></button><strong>${item.quantity}</strong><button type="button" data-id="${escapeHTML(item.id)}" data-delta="1" aria-label="Increase quantity" ${item.quantity>=safeNumber(item.stock)?'disabled':''}><span class="icon">add</span></button></div><strong class="cart-line-price">${money(item.price*item.quantity)}</strong><button class="remove-item" type="button" data-remove="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.name)}"><span class="icon">close</span></button></div>`).join('');$('cart-items').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const fallback=fallbackDishImage(cart.find(item=>item.name===img.alt)||{});if(fallback&&img.getAttribute('src')!==fallback){img.src=fallback;return}img.remove()}));$('cart-items').querySelectorAll('[data-delta]').forEach(btn=>btn.addEventListener('click',()=>changeQuantity(btn.dataset.id,Number(btn.dataset.delta))));$('cart-items').querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{cart=cart.filter(x=>x.id!==btn.dataset.remove);saveCart();renderMenu()}));updateCart()}
    function setView(view){const cartView=view==='cart';$('menu-page').classList.toggle('active',!cartView);$('cart-page').classList.toggle('active',cartView);document.querySelectorAll('[data-view]').forEach(a=>a.classList.toggle('active',!cartView&&a.classList.contains('links')===false&&a.textContent.trim()==='Home'));if(cartView){renderCart();refreshProducts()}window.scrollTo({top:0,behavior:'smooth'})}
    function applyCoupon(){const code=$('coupon-input').value.trim().toUpperCase();const msg=$('coupon-message');coupon='';msg.classList.remove('error');if(!code){msg.textContent='';updateCart();return}if(code==='SAVOR20'||code==='FEAST10'){coupon=code;msg.textContent=code==='SAVOR20'?'SAVOR20 applied — ₹50 off orders over ₹300.':'FEAST10 applied — ₹100 off orders over ₹300.'}else{msg.textContent='Invalid code. Try SAVOR20 or FEAST10.';msg.classList.add('error')}updateCart()}
    async function placeOrder(){if(busy||refreshingMenu||!cart.length||!liveProductsLoaded)return;const err=$('order-error');err.classList.add('hidden');const changes=await refreshProducts();if(changes===null)return;if(changes.length){showToast('Your cart changed with the live menu. Review it before ordering.');return}if(!cart.length||!liveProductsLoaded)return;const orderItems=cart.map(item=>({itemId:item.id,quantity:item.quantity}));busy=true;$('order-spinner').classList.remove('hidden');$('place-order').querySelector('.icon').classList.add('hidden');updateCart();
      try{
        const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'createOrder',items:orderItems})});
        if(!response.ok)throw new Error(`Order request failed (${response.status}).`);
        let result={};try{result=await response.json()}catch{throw new Error('The server response could not be read. Please check your orders before retrying.')}
        if(result.success===false||result.error)throw new Error(result.message||result.error||'The restaurant could not accept this order.');
        const id=result.orderId??result.id??result.data?.orderId??result.data?.id;
        cart=[];coupon='';$('coupon-input').value='';$('coupon-message').textContent='';try{localStorage.removeItem(CART_KEY)}catch{}
        $('order-id').textContent=id?`Order #${escapeHTML(id)}`:'Order received';$('success-modal').classList.add('open');renderCart();renderMenu();
      }catch(error){err.textContent=(error.message||'Could not place order.')+' Your cart is saved. Please retry.';err.classList.remove('hidden')}
      finally{busy=false;$('order-spinner').classList.add('hidden');$('place-order').querySelector('.icon').classList.remove('hidden');updateCart()}
    }
    document.querySelectorAll('a[href="#cart"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setView('cart')}));document.querySelectorAll('[data-view="menu"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setView('menu')}));
    $('menu-search').addEventListener('input',e=>{$('nav-search').value=e.target.value;query=e.target.value;renderMenu()});$('nav-search').addEventListener('input',e=>{$('menu-search').value=e.target.value;query=e.target.value;renderMenu()});$('apply-coupon').addEventListener('click',applyCoupon);$('coupon-input').addEventListener('keydown',e=>{if(e.key==='Enter')applyCoupon()});$('place-order').addEventListener('click',placeOrder);$('modal-done').addEventListener('click',()=>{$('success-modal').classList.remove('open');setView('menu')});$('success-modal').addEventListener('click',e=>{if(e.target===$('success-modal'))$('success-modal').classList.remove('open')});
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('nav-search').focus()}if(e.key==='Escape')$('success-modal').classList.remove('open')});
    updateCart();refreshProducts({initial:true});
  })();
